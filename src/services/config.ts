/**
 * ConfigService — Zod-validated, fail-fast configuration.
 *
 * Stores non-sensitive settings + paths to encrypted blobs.
 * Inspired by sapbruno config + url-shortener strict env patterns.
 */

import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
} from 'node:fs';

const DEFAULT_CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'tg-codex'
);

const ConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  // Where to store the encrypted credential/session blob
  secretsPath: z.string().default(join(DEFAULT_CONFIG_DIR, 'secrets.enc')),
  // Base dir for research packs (user can override)
  researchDir: z.string().default(join(homedir(), 'tg-codex-research')),
  // AI CLI command (user can point to codex, claude, gemini, custom wrapper, etc.)
  aiCommand: z.string().default('codex'),
  // Extra args always passed to AI CLI (e.g. --full-auto)
  aiExtraArgs: z.array(z.string()).default([]),
  // Default limits for scans (can be overridden by flags)
  defaultMaxPerGroup: z.number().int().min(10).max(2000).default(150),
  defaultConcurrency: z.number().int().min(1).max(5).default(2),
  // Last used groups / presets (light cache for UX)
  recentPresets: z
    .array(
      z.object({
        name: z.string(),
        groupIds: z.array(z.union([z.number(), z.string()])),
      })
    )
    .default([]),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigService {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath?: string) {
    const baseDir = DEFAULT_CONFIG_DIR;
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    }

    this.configPath = configPath || join(baseDir, 'config.json');

    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = ConfigSchema.parse(parsed);
      } catch (err) {
        console.warn('Warning: existing config invalid, using defaults + backup.');
        this.config = ConfigSchema.parse({});
        this.backupBrokenConfig();
      }
    } else {
      this.config = ConfigSchema.parse({});
      this.save();
    }

    // Ensure research dir exists
    if (!existsSync(this.config.researchDir)) {
      mkdirSync(this.config.researchDir, { recursive: true, mode: 0o700 });
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    // Re-validate on mutation
    const next = { ...this.config, [key]: value };
    this.config = ConfigSchema.parse(next);
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  /** Full path to the encrypted secrets file */
  getSecretsPath(): string {
    return this.config.secretsPath;
  }

  getResearchDir(): string {
    return this.config.researchDir;
  }

  getAiCommand(): string {
    return this.config.aiCommand;
  }

  private save(): void {
    const tmp = this.configPath + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 });
    renameSync(tmp, this.configPath);
  }

  private backupBrokenConfig(): void {
    try {
      const backup = this.configPath + '.broken.' + Date.now();
      copyFileSync(this.configPath, backup);
    } catch {
      // ignore
    }
  }
}

// Singleton for convenience in commands (can be overridden in tests)
let defaultConfig: ConfigService | null = null;

export function getConfig(): ConfigService {
  if (!defaultConfig) {
    defaultConfig = new ConfigService();
  }
  return defaultConfig;
}

export function resetConfigForTests(newPath?: string): ConfigService {
  defaultConfig = new ConfigService(newPath);
  return defaultConfig;
}
