/**
 * TelegramService — resilient wrapper around gramjs (telegram npm package).
 *
 * Responsibilities:
 * - Authentication wizard (phone, code, 2FA password)
 * - Session management (load/save encrypted StringSession)
 * - Safe dialog listing + message search/history with FloodWait handling
 * - Never perform write operations on the account (read-only by design)
 *
 * References:
 * - Official gramjs examples for StringSession + client.start
 * - Must handle FloodWaitError (error.seconds)
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

import { ConfigService, getConfig } from '../config.js';
import { CryptoService } from '../crypto.js';
import { promptText, closePrompts } from '../../utils/prompt.js';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname as pathDirname } from 'node:path';

export interface DialogInfo {
  id: number | string; // big int often
  title: string;
  username: string | undefined;
  type: 'group' | 'supergroup' | 'channel' | 'private';
  memberCount?: number;
  lastMessageDate: Date | undefined;
}

export class TelegramService {
  private client: TelegramClient | null = null;
  private session: StringSession | null = null;
  private config: ConfigService;

  constructor(config?: ConfigService) {
    this.config = config || getConfig();
  }

  /** Returns true if we have a loaded (but not necessarily connected) session */
  get isLoggedIn(): boolean {
    return !!this.session && this.session.save() !== '';
  }

  /**
   * Full interactive login wizard.
   * Guides user for api_id/hash if missing, then phone → code → (password).
   * On success, encrypts and persists the StringSession.
   */
  async loginInteractive(): Promise<void> {
    console.log(chalk.cyan('\n=== tg-codex Telegram Login ===\n'));

    // 1. Ensure api credentials
    let apiId: number;
    let apiHash: string;

    // For Phase 1 we store api creds also encrypted in same blob for simplicity.
    // In real we can have separate or combined.
    // Here: we will prompt and store them together with the session string.

    const existingSecrets = this.loadEncryptedSecretsSync();

    if (existingSecrets) {
      const pw = await promptText(chalk.yellow('Enter your tg-codex encryption passphrase: '), { mask: true });
      try {
        const decrypted = CryptoService.decrypt(existingSecrets, pw);
        const parsed = JSON.parse(decrypted);
        apiId = parsed.apiId;
        apiHash = parsed.apiHash;
        if (parsed.session) {
          this.session = new StringSession(parsed.session);
        }
        console.log(chalk.green('Unlocked existing credentials.'));
      } catch (e) {
        console.error(chalk.red('Failed to decrypt with that passphrase.'));
        throw e;
      }
    } else {
      console.log('First time setup: you need api_id + api_hash from https://my.telegram.org');
      console.log('1. Log in with your phone number');
      console.log('2. Go to "API development tools"');
      console.log('3. Create a new "App" (Desktop or Other is fine)');
      console.log('4. Copy the numbers.\n');

      const apiIdStr = await promptText('api_id (number): ');
      apiId = parseInt(apiIdStr, 10);
      if (!apiId || isNaN(apiId)) throw new Error('Invalid api_id');

      apiHash = await promptText('api_hash: ');
      if (!apiHash || apiHash.length < 10) throw new Error('Invalid api_hash');

      await this.chooseNewPassphrase();

      // We will save after successful login
      this.session = new StringSession('');
    }

    if (!this.client) {
      this.client = new TelegramClient(this.session!, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false, // TCP usually more reliable for long sessions
      });
    }

    console.log(chalk.gray('\nConnecting to Telegram...'));

    await this.client.start({
      phoneNumber: async () => {
        const phone = await promptText('Phone number (intl format, e.g. +84901234567): ');
        return phone;
      },
      phoneCode: async () => {
        const code = await promptText('Code from Telegram (SMS or app): ');
        return code;
      },
      password: async () => {
        const pw = await promptText('2FA cloud password (if enabled): ', { mask: true });
        return pw;
      },
      onError: (err) => {
        console.error(chalk.red('Telegram error during auth:'), err);
      },
    });

    console.log(chalk.green('\n✓ Successfully logged in as ' + (await this.client.getMe()).username || 'user'));

    // Save encrypted
    const saved = this.client.session.save();
    const finalSession: string = typeof saved === 'string' ? saved : '';
    const savePw = await this.ensurePassphraseForSave();
    const blob = {
      apiId,
      apiHash,
      session: finalSession,
    };
    const enc = CryptoService.encrypt(JSON.stringify(blob), savePw);
    this.saveEncryptedSecrets(enc);

    closePrompts();
    console.log(chalk.green('Session saved securely (encrypted).'));
  }

  async logout(): Promise<void> {
    const secretsPath = this.config.getSecretsPath();
    try {
      unlinkSync(secretsPath);
      console.log(chalk.green('Logged out. Encrypted secrets removed.'));
    } catch {
      console.log('No session found.');
    }
    this.client = null;
    this.session = null;
  }

  async getDialogs(limit = 200): Promise<DialogInfo[]> {
    if (!this.client) {
      await this.ensureConnected();
    }

    const dialogs = await this.client!.getDialogs({ limit });

    const result: DialogInfo[] = [];

    for (const d of dialogs) {
      const entity = d.entity;
      if (!entity) continue;

      let type: DialogInfo['type'] = 'private';
      let title = '';
      let username: string | undefined;

      if ('title' in entity) {
        title = entity.title || '';
        if ('megagroup' in entity && entity.megagroup) type = 'supergroup';
        else if ('broadcast' in entity && entity.broadcast) type = 'channel';
        else type = 'group';
      } else if ('firstName' in entity || 'lastName' in entity) {
        title = [entity.firstName, entity.lastName].filter(Boolean).join(' ') || 'Unknown';
        type = 'private';
      }

      if ('username' in entity && entity.username) {
        username = entity.username;
      }

      result.push({
        id: entity.id?.toString() ?? d.id?.toString() ?? '',
        title,
        username,
        type,
        lastMessageDate: d.date ? new Date(d.date * 1000) : undefined,
      });
    }

    return result;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client || !this.session) {
      throw new Error('Not logged in. Run "tg-codex login" first.');
    }
    if (!this.client.connected) {
      await this.client.connect();
    }
  }

  private loadEncryptedSecretsSync() {
    const path = this.config.getSecretsPath();
    if (!existsSync(path)) return null;
    try {
      const raw = readFileSync(path, 'utf8');
      return JSON.parse(raw) as { data: string };
    } catch {
      return null;
    }
  }

  private saveEncryptedSecrets(blob: { data: string }): void {
    const path = this.config.getSecretsPath();
    const dir = pathDirname(path);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(blob), { mode: 0o600 });
  }

  private async chooseNewPassphrase(): Promise<string> {
    console.log(chalk.yellow('\nYou need to choose an encryption passphrase.'));
    console.log('This passphrase protects your Telegram session on disk.');
    console.log('Remember it — you will need it for future runs.\n');

    let chosenPw = '';
    while (true) {
      chosenPw = await promptText('Choose passphrase (min 8 chars): ', { mask: true });
      if (chosenPw.length >= 8) break;
      console.log(chalk.red('Too short.'));
    }
    const confirm = await promptText('Confirm passphrase: ', { mask: true });
    if (chosenPw !== confirm) {
      throw new Error('Passphrases did not match');
    }
    return chosenPw;
  }

  private async ensurePassphraseForSave(): Promise<string> {
    // In a real flow we would remember the one used at login.
    // For simplicity in Phase 1: ask again (user can improve UX later).
    return promptText('Enter your tg-codex encryption passphrase again to save session: ', { mask: true });
  }
}
