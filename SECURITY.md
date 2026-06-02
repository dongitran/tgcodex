# SECURITY.md — tg-codex

This document describes the security model, encryption, spawn hardening, privacy considerations, and threat mitigations for tg-codex.

**Read this before using the tool, especially before running `login` or scanning groups that contain sensitive information.**

---

## Threat Model

- **You** are the only user. The tool runs locally on your machine.
- Primary assets:
  - Your Telegram API credentials (`api_id`, `api_hash`)
  - Your Telegram user session (StringSession / auth key — equivalent to being logged in)
  - Contents of your Telegram groups (often personal, financial, confidential, career-related)
  - Any research packs and AI outputs derived from them
- Adversary: Local malware, shoulder surfing, accidental commit to git, compromised AI CLI that tries to exfiltrate, future supply-chain in dependencies.

The tool is intentionally **read-only** on Telegram and performs **no network calls except to Telegram servers and your local Codex process**.

---

## Encryption at Rest

All sensitive Telegram material is encrypted before being written to disk (config or SQLite blobs).

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key derivation**: Interactive passphrase (user types on first use / unlock). The passphrase is **never stored**. It only lives in memory for the current process lifetime (or until explicit lock).
- **Storage format** (simplified): `base64(iv):base64(authTag):base64(ciphertext)`
- **What is encrypted**:
  - `api_id` + `api_hash`
  - Full `StringSession` from gramjs
  - (Future) any cached tokens or other secrets
- **What is NOT encrypted** (by design, low sensitivity):
  - Group metadata cache (titles, ids, last message dates, your presets)
  - Research history metadata (timestamps, query text, pack paths)
  - Research packs themselves (they live in your `~/tg-codex-research/...` or temp — you control them)

On `logout` we delete the encrypted blobs.

**Best practice**: Use a strong, unique passphrase. Consider using your password manager to store the passphrase as a note (not the session itself).

### Optional OS Keychain

Future enhancement: Use `keytar` (or native `security` on macOS / Windows Credential Manager) to store a derived master key instead of prompting every time. The tool will gracefully fall back to passphrase.

---

## Hardened External Execution (Codex CLI)

When the tool spawns `codex` (assisted mode) or any other configured AI CLI:

1. **Pre-flight check**: `hasCodex()` probes with `spawn(..., {stdio:'ignore'})` and checks exit code.
2. **Never use shell**: `spawn(binary, argsArray, { shell: false, cwd: isolatedDir })`
3. **Full sanitization** (see `src/utils/security.ts` — modeled directly on the excellent defensive code in `02-bitwarden-mcp-server`):
   - Strip null bytes, newlines, control chars, dangerous shell metachars (`;&|`$(){}[]<>'"`, backticks, etc.)
   - Iterative URL/path decode + NFC Unicode normalization
   - Reject path traversal (`../`, fullwidth lookalikes, encoded variants)
   - Allowlist-based directory validation (research packs only go under approved temp or `~/tg-codex-research`)
   - Command allowlist where applicable
4. **CWD isolation**: Codex (when spawned) is started inside a freshly created research pack directory containing only the curated context we prepared. It cannot see your home or other projects unless you explicitly `cd` there later.
5. **No automatic file writes from Codex back into your real workspace** in assisted mode (we capture output; user reviews before any manual copy).

**Recommendation**: Prefer the **export pack + manual `cd && codex`** workflow for any high-stakes or long research. It gives you full visibility and control.

---

## Telegram Account Safety

- Conservative defaults: low concurrency (1-3), explicit `--max-per-group`, `--since` limits.
- FloodWait handling is **mandatory** in the TelegramService. We sleep the exact time Telegram tells us + jitter. Scans of very large groups can take significant time — this is by design.
- The tool **never** calls methods that send messages, join channels, add contacts, or perform write operations on your account (unless future features are added behind explicit flags + warnings).
- Large supergroups sometimes have restricted update delivery. We rely primarily on explicit `search` + `getMessages` (polling style during a scan), not live event handlers for the core research flow.

**If you notice strange behavior on your Telegram apps after using the tool (logged out everywhere, etc.):** immediately logout from tg-codex and review active sessions at https://my.telegram.org.

---

## Data Flow & Minimization

1. You type a research goal in Vietnamese or English.
2. Tool uses Telegram's own server-side search (best possible relevance, minimal data transfer) + limited recent history.
3. Only "promising" messages + small context windows are fetched.
4. We build a **curated, deduplicated, source-linked** set of excerpts (with direct `t.me/c/...` or `@username/...` links).
5. This is written as plain Markdown files inside a pack.
6. You (or the assisted spawn) point Codex at that pack.
7. Codex reasons locally using your OpenAI key/subscription.
8. Output comes back to you in terminal + saved in the pack.

We deliberately **do not** send full unfiltered history. We do not index everything locally by default (you can always export raw if you want to feed other tools).

---

## What the Tool Does NOT Do

- Does **not** exfiltrate data to any third party (no telemetry, no phoning home).
- Does **not** store your Codex/OpenAI key (it only calls whatever binary you configured via PATH).
- Does **not** decrypt or use your session except while the process is running and you have unlocked it.
- Does **not** run as a background daemon or persistent watcher by default (foreground `watch` may be added later with explicit consent).

---

## Supply Chain & Dependencies

- Core risky deps: `gramjs` (talks to Telegram), `better-sqlite3` (native), `ink` + `react` (TUI).
- We pin major versions and will audit on updates.
- `child_process` usage is extremely restricted (see above).

Run `npm audit` / `pnpm audit` regularly.

---

## Incident Response (If Something Goes Wrong)

1. `tg-codex logout` (deletes encrypted blobs from your config dir).
2. Go to https://my.telegram.org → Active sessions → Terminate all other sessions.
3. Change your Telegram 2FA password if you suspect compromise.
4. Review any research packs you created (they may contain excerpts of sensitive chats) and delete them.
5. If you used assisted spawn: inspect the temp research dir and any Codex trajectory files.

---

## Best Practices for Owners

- Use a dedicated "research" Telegram account if you have very high sensitivity in main account (many people do this).
- Always review the generated pack (list of sources) before letting Codex analyze.
- Prefer `--export-only` for anything involving money, legal, health, or career-sensitive topics.
- Keep your Codex installation up to date.
- Store the encryption passphrase in a password manager (as a secure note), not in any dotfile.
- Periodically run `tg-codex groups` and clean old / archived groups from cache if desired (future command).

---

## Reporting Issues

If you find a security bug (path traversal in packer, weak encryption, command injection vector, etc.), treat it seriously. Fix + add test case immediately. Update this document.

This tool was designed with the same defensive posture as the owner's other security-sensitive projects (Bitwarden MCP, account platform token handling, etc.).

**Your groups are your data. Treat them accordingly.**
