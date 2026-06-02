/**
 * Minimal interactive prompt helpers for CLI wizards (login etc).
 * Pure Node (readline) — no extra deps. Good enough until full Ink TUI.
 *
 * For beautiful TUI prompts we will use Ink components in Phase 3+.
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

let rl: readline.Interface | null = null;

function getRl() {
  if (!rl) {
    rl = readline.createInterface({ input, output });
  }
  return rl;
}

export async function promptText(question: string, opts: { mask?: boolean } = {}): Promise<string> {
  const r = getRl();
  if (opts.mask) {
    // Simple mask for passwords (still echoes • on some terminals)
    // For real secret input, in production we might use 'input' or 'readline' tricks.
    (r as any).historySize = 0;
    const answer = await r.question(question);
    return answer.trim();
  }
  const answer = await r.question(question);
  return answer.trim();
}

export async function promptConfirm(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const ans = (await promptText(question + suffix)).toLowerCase();
  if (ans === '') return defaultYes;
  return ans === 'y' || ans === 'yes';
}

export function closePrompts(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
