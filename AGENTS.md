# AGENTS.md — tg-codex (27-telegram-codex)

> Context file for AI coding assistants (Claude Code, Cursor, Aider, GitHub Copilot, etc.).
> This is a professional personal CLI tool for the owner (senior fullstack JS/TS dev).

---

## Project Overview

**tg-codex** — CLI + beautiful Ink TUI that lets you authenticate a real Telegram user account (MTProto via gramjs), intelligently retrieve/search messages across your groups, prepare high-signal structured research packs, and feed them to **OpenAI Codex CLI** (or other AI agents) for deep analysis, summarization, extraction, and brainstorming.

Primary magic: turn chaotic Telegram group history (work deals, tech discussions, communities, family, career intel, etc.) into queryable, source-linked, AI-synthesizable personal knowledge — all locally, privately, with professional terminal UX.

- **Runtime**: Node.js >= 20.18 (ESM)
- **CLI**: Commander.js (subcommands + powerful flags) + Ink (React TUI for interactive dashboard)
- **Telegram**: gramjs (full user MTProto: login, getDialogs, messages.search, getMessages, FloodWait handling)
- **Storage**: better-sqlite3 (groups cache, cursors, history, presets) + Zod schemas
- **Security**: AES-256-GCM encryption for api creds + StringSession (passphrase or keychain); extreme-hardened spawn for Codex (modeled on bitwarden security.ts)
- **Core Innovation**: ResearchPipeline (retriever → enricher with t.me deep links → packer into Codex-friendly dir structure with MISSION.md + curated sources)
- **Architecture**: Thin commands → services (manual wiring) → domain logic. Pluggable AiAdapter. Resilient Telegram wrapper.

**Key principle**: Primary value is **preparing perfect context** for Codex (export research pack always works great). Assisted spawn is secondary/best-effort.

---

## Critical Rules — Read Before Any Change

### Security (Non-Negotiable)
- **NEVER** spawn external commands (codex, or anything) without going through hardened `buildSafeCommand` + full sanitizers/validators/allowlists from `src/utils/security.ts` (port of bitwarden patterns + path traversal defense).
- **NEVER** log, print, or persist raw api_id, api_hash, StringSession, or decrypted data except in-memory for active session.
- **ALWAYS** use `shell: false`, array args, explicit cwd isolation (`/tmp` or user research dir) for any spawn.
- Encryption: AES-256-GCM with random IV + authTag. Store as `iv:tag:ciphertext` (base64 parts). Master key only from interactive passphrase prompt (never env for sessions) or OS keychain.
- On every security-related file change: re-run security tests (`vitest tests/security` or equivalent).

### Telegram / Privacy / ToS
- This tool is **read-only** on Telegram (get/search history only). Never send, join, invite, or modify unless explicitly added as future opt-in feature with big warnings.
- **ALWAYS** surface privacy/ToS warnings on login, first scan, and in README.
- Rate limits: Conservative concurrency (p-limit 1-3), mandatory FloodWait backoff + jitter. Update cursors on every successful/partial scan.
- Real account only (api_id/hash from my.telegram.org required). Bots are useless for broad group access.
- Test with care: owner's groups may contain sensitive/personal data. Prefer test account or very limited `--groups` + `--since`.

### Code Quality (Strict — copied from 10-url-shortener + repo conventions)
- **ALWAYS**: Explicit return types on async functions.
- **ALWAYS**: `catch (error: unknown) { if (error instanceof Error) ... }`
- **NEVER**: `any`, `@ts-ignore`, non-null assertion (`!`), TypeScript `enum`.
- Use `as const` + `typeof ...[keyof ...]` for constants.
- Zod schemas for **everything** that crosses boundary (config, CLI opts after parse, DB rows, API responses from gramjs where possible).
- Errors: Define domain errors (extend base `AppError` or simple custom classes). Never throw raw `Error` for business cases.
- File size: Keep services focused (< ~400-500 LOC ideal). Extract pure utils.
- Imports: Prefer named, use `import type` for types.

### Testing Requirements
- Unit tests for pure logic: crypto, packer, flood-wait handler, link builder, query processor (mocks for gramjs/Codex).
- Security tests exhaustive (injection, path traversal unicode/double-encode, null bytes, newlines — like bitwarden `tests/security.spec.ts`).
- Integration: Use fresh in-memory or temp SQLite + mocked TelegramClient where possible.
- Before any commit/push: run `pnpm validate` (typecheck + lint + test). 0 warnings tolerance on lint.
- Coverage target: 70%+ on src/services/** and src/utils/** (business logic).

### Git & Commits
- Conventional Commits (English or VN short ok):
  - `feat: add encrypted session storage with AES-GCM`
  - `fix: handle FloodWaitError with exact sleep + jitter`
  - `docs: update login wizard instructions for my.telegram.org`
  - `security: harden codex spawn with full path validation`
- Commit frequently after meaningful + verified change.
- Never commit: `.env*`, `*.db`, `*-session*`, `dist/`, coverage, logs, research packs.

### UX / VN Language
- User-facing text (prompts, help, TUI, errors, success) should be **Vietnamese-first** for owner comfort, with clear technical terms.
- CLI flags, code, logs, Mermaid remain English.
- TUI: keyboard-first (arrows, space select, enter confirm, q/ctrl-c quit, / for filter). Beautiful but not flashy (cyan/green/yellow per convention, boxes, live updating).

### Never Do
- Use `child_process.exec` or `shell: true` anywhere.
- Hardcode or default-encrypt with weak keys.
- Fetch unbounded history without `--max-per-group` / `--since` / search-first strategy.
- Assume Codex is always non-interactive or parse its stdout blindly for v1 (pack export is truth).
- Skip FloodWait handling or cursor updates.
- Touch real production groups in automated tests.

---

## Dev Environment & Setup

```bash
cd 01-projects/27-telegram-codex

# Install (npm or pnpm — package.json compatible)
npm install
# or pnpm install

# Dev run (no build needed)
npm run dev -- --help

# Typecheck / lint / test gate
npm run validate

# Build for bin use
npm run build
./dist/cli.js --version
```

**Prerequisites for real use**:
- Node 20+
- Codex CLI installed (`npm i -g @openai/codex` or via their installer) + authenticated
- Telegram api_id + api_hash (create at https://my.telegram.org → API development tools)

---

## Project Structure (Current / Target)

See plan.md (in session) or `docs/plans/00-telegram-codex-architecture.md` for full rationale + data models + flows.

Key:
- `src/cli.ts` — entry (shebang + Commander program)
- `src/commands/` — thin orchestration
- `src/services/` — core (telegram resilient wrapper, crypto, storage, research pipeline, ai adapters)
- `src/tui/` — Ink React components (Dashboard, GroupPicker, etc.)
- `src/utils/security.ts` — THE security bible (never bypass)
- `tests/` — unit + integration + helpers (mocks, attack vectors, fresh DB)
- `docs/plans/` — architecture decisions (tables, Mermaid, why this choice)

---

## Common Tasks for Agents

- Adding a new CLI flag or command: Update Commander in cli.ts or dedicated command file. Add Zod schema for validation. Update README + help examples.
- Changing research logic: Touch only under `src/services/research/`. Add unit test. Verify pack output manually with real (limited) data.
- TUI change: Work in `src/tui/components/`. Keep re-renders minimal. Test resize + keyboard on macOS terminal.
- Security fix: Update security.ts + add test case + run full security suite.
- Telegram client change: All access goes through `TelegramService`. Never leak client instance.
- After login-related change: Manually test full wizard flow (phone → code → 2FA if enabled).

---

## Verification Before Handover

```bash
npm run validate
# + manual:
# 1. tg-codex login (with test account or careful real)
# 2. tg-codex groups
# 3. tg-codex scan --query "test" --groups <one small> --since 7d --export-only
# 4. Inspect generated pack dir + t.me links
# 5. Point codex at the pack manually and confirm good output
```

**Owner note**: This tool will be daily driver for career/tech/life research from groups. Quality bar is extremely high — match or exceed 02-bitwarden / 17-sapbruno / 10-url-shortener professionalism in this repo.

---

When in doubt: re-read this file + the approved plan.md + SECURITY.md. Ask owner for clarification on privacy boundaries or real account testing.

Good luck — make it excellent.
