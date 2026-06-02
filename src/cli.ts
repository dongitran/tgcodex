#!/usr/bin/env node
/**
 * tg-codex — Professional Telegram + Codex research CLI
 *
 * Entry point. Uses Commander for structure + dispatches to commands or TUI.
 * See AGENTS.md and the approved plan for architecture and rules.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TelegramService } from './services/telegram/client.js';
import { getConfig } from './services/config.js';
import { createResearchPack } from './services/research/packer.js';
import { runTui } from './tui/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version (works in both src and dist)
let pkg: { version: string; description?: string };
try {
  const pkgPath = join(__dirname, '..', 'package.json');
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch {
  pkg = { version: '0.0.0-dev' };
}

const program = new Command();

program
  .name('tg-codex')
  .description(
    chalk.cyan('tg-codex') +
      ' — Biến Telegram groups của bạn thành nguồn tri thức AI-powered (Codex CLI)'
  )
  .version(pkg.version, '-v, --version', 'Show version')
  .helpOption('-h, --help', 'Show help')
  .showHelpAfterError(true);

// -----------------------------------------------------------------------------
// Placeholder commands (will be expanded in later phases)
// -----------------------------------------------------------------------------

program
  .command('login')
  .description('Authenticate with Telegram (phone + code + 2FA wizard)')
  .action(async () => {
    const tg = new TelegramService();
    try {
      await tg.loginInteractive();
    } catch (err: any) {
      console.error(chalk.red('Login failed:'), err?.message || err);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Clear local encrypted session and credentials')
  .action(async () => {
    const tg = new TelegramService();
    await tg.logout();
  });

program
  .command('whoami')
  .description('Show current authenticated account + Codex status')
  .action(async () => {
    const config = getConfig();
    const tg = new TelegramService();
    console.log(chalk.blue.bold('tg-codex status'));
    console.log('  Config dir:   ', dirname(config.getSecretsPath()));
    console.log('  Research dir: ', config.getResearchDir());
    console.log('  AI command:   ', config.getAiCommand());
    console.log('  Logged in:    ', tg.isLoggedIn ? chalk.green('yes') : chalk.red('no (run "tg-codex login")'));
    // TODO Phase 2: also probe Codex binary
  });

program
  .command('groups')
  .description('List cached groups (from Telegram), search, manage presets')
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Max groups to show', '50')
  .action(async (opts) => {
    const tg = new TelegramService();
    try {
      const groups = await tg.getDialogs(parseInt(opts.limit, 10));
      if (opts.json) {
        console.log(JSON.stringify(groups, null, 2));
        return;
      }
      console.log(chalk.cyan.bold(`\nYour groups (${groups.length} shown)\n`));
      groups.slice(0, 30).forEach((g, i) => {
        const badge = g.type === 'supergroup' || g.type === 'group' ? chalk.green('G') : chalk.blue('C');
        const user = g.username ? chalk.gray('@' + g.username) : '';
        console.log(`${(i + 1).toString().padStart(2)}. ${badge} ${g.title} ${user}`);
      });
      if (groups.length > 30) {
        console.log(chalk.gray(`... and ${groups.length - 30} more (use --json or TUI for full)`));
      }
      console.log(chalk.gray('\nTip: Use the interactive TUI (default tg-codex) for multi-select and presets.'));
    } catch (err: any) {
      console.error(chalk.red('Failed to fetch groups:'), err?.message || err);
      console.log('Did you run "tg-codex login" yet?');
    }
  });

program
  .command('scan')
  .description('Run research scan across groups — creates perfect Codex research pack (primary value)')
  .option('-q, --query <query>', 'Research goal / question (Vietnamese or English)')
  .option('-g, --groups <groups>', 'Comma-separated group titles or ids, or preset name')
  .option('--since <since>', 'Only messages after this (e.g. 30d, 2026-05-01)', '30d')
  .option('--max-per-group <n>', 'Max messages to consider per group', '150')
  .option('--export-only', 'Only create research pack (recommended)')
  .option('--assist', 'Attempt hardened assisted Codex spawn (experimental in v0.1)')
  .action(async (opts) => {
    const query = opts.query || 'tìm thông tin quan trọng trong các group gần đây';
    const groups = (opts.groups || 'demo-group').split(',').map((s: string) => s.trim());

    console.log(chalk.cyan(`\nCreating research pack for: "${query}"`));
    console.log('Groups:', groups.join(', '));

    const pack = createResearchPack({
      query,
      groups,
      since: opts.since,
      // In real Phase 2 this would come from TelegramService + enricher
      simulatedHits: [
        {
          group: groups[0],
          text: 'Ví dụ: "Deal X đang chạy, cần confirm trước 15/6. @nguoi1 @nguoi2". (Data thật sẽ được fetch từ Telegram khi bạn login + chạy scan với groups thật)',
          msgId: 987654,
          date: new Date().toISOString(),
        },
      ],
    });

    console.log(chalk.green('\n✓ Research pack created successfully!'));
    console.log('  Path:       ', pack.path);
    console.log('  MISSION:    ', pack.missionPath);
    console.log('\nNext:');
    console.log(chalk.bold(`  cd ${pack.path}`));
    console.log(chalk.bold('  codex'));
    console.log('\nOr run the helper:');
    console.log('  bash RUN_CODEX.sh');
    console.log(chalk.gray('\n(Real data + smart retrieval + t.me deep links will come when you use real groups after login.)'));
  });

// -----------------------------------------------------------------------------
// Default command → launch TUI (the professional experience)
// This matches the sapbruno pattern the plan chose as closest analog.
// -----------------------------------------------------------------------------

program
  .command('ui', { isDefault: true })
  .description('Launch the interactive Ink TUI dashboard (default)')
  .option('--no-welcome', 'Skip welcome banner')
  .action(async (opts) => {
    if (!opts.welcome) {
      console.log(
        chalk.bold.cyan('\n tg-codex ') +
          chalk.gray(`v${pkg.version}`) +
          '\n' +
          ' Professional Telegram research CLI powered by Codex\n'
      );
    }

    console.log(chalk.green('✓  Launching TUI... (skeleton)'));
    runTui();
    // runTui renders and keeps process alive until user exits
    // If we reach here the TUI exited
    process.exit(0);
  });

// -----------------------------------------------------------------------------
// Global error handling + parse
// -----------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled rejection:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught exception:'), err);
  process.exit(1);
});

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('Error:'), err?.message || err);
  process.exit(1);
});
