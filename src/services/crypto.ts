/**
 * CryptoService — AES-256-GCM encryption for sensitive material (api creds + StringSession).
 *
 * Design goals (per SECURITY.md + bitwarden/account-seller patterns):
 * - Authenticated encryption (GCM provides confidentiality + integrity)
 * - Random IV per encryption
 * - Never log or persist plaintext
 * - Simple serialize format: iv:tag:ciphertext (all base64, colon separated)
 * - Passphrase is only source of key (user memory / password manager)
 *
 * The master key is derived via a simple but sufficient method for this use case:
 * - scrypt (or PBKDF2) with good params. We use Node's crypto.scrypt for forward secrecy properties.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // recommended for GCM
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT_LEN = 16;
const SCRYPT_N = 1 << 14; // 16384 — good balance
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export interface EncryptedBlob {
  /** base64(salt) : base64(iv) : base64(tag) : base64(ciphertext) */
  data: string;
}

export class CryptoService {
  /**
   * Encrypt plaintext with a user passphrase.
   * Returns a string safe to store in JSON / SQLite text column.
   */
  static encrypt(plaintext: string, passphrase: string): EncryptedBlob {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('plaintext must be a non-empty string');
    }
    if (!passphrase || passphrase.length < 8) {
      throw new Error('passphrase must be at least 8 characters for reasonable security');
    }

    const salt = randomBytes(SALT_LEN);
    const key = this.deriveKey(passphrase, salt);
    const iv = randomBytes(IV_LEN);

    const cipher = createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const serialized = [
      salt.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');

    return { data: serialized };
  }

  /**
   * Decrypt. Throws on bad passphrase, tampered data, or format error.
   */
  static decrypt(blob: EncryptedBlob, passphrase: string): string {
    if (!blob?.data || typeof blob.data !== 'string') {
      throw new Error('Invalid encrypted blob');
    }
    if (!passphrase) {
      throw new Error('passphrase is required');
    }

    const parts = blob.data.split(':');
    if (parts.length !== 4) {
      throw new Error('Corrupt encrypted data (wrong number of segments)');
    }

    const [saltB64, ivB64, tagB64, ctB64] = parts as [string, string, string, string];

    let salt: Buffer, iv: Buffer, tag: Buffer, ciphertext: Buffer;
    try {
      salt = Buffer.from(saltB64, 'base64');
      iv = Buffer.from(ivB64, 'base64');
      tag = Buffer.from(tagB64, 'base64');
      ciphertext = Buffer.from(ctB64, 'base64');
    } catch {
      throw new Error('Corrupt encrypted data (base64 decode failed)');
    }

    if (salt.length !== SALT_LEN || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      throw new Error('Corrupt encrypted data (length mismatch)');
    }

    const key = this.deriveKey(passphrase, salt);

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    try {
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch (err: unknown) {
      // Most common: wrong passphrase or tampered ciphertext
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Decryption failed (wrong passphrase or data corruption): ${msg}`);
    }
  }

  private static deriveKey(passphrase: string, salt: Buffer): Buffer {
    // scrypt is memory-hard and recommended
    return scryptSync(passphrase, salt, KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
  }

  /**
   * Helper: generate a strong random passphrase suggestion (for first-time users).
   * Not used automatically — user can copy if they want.
   */
  static generateStrongPassphrase(): string {
    return randomBytes(18).toString('base64url'); // ~24 chars, good entropy
  }
}
