# tgcodex

<p align="center">
  <a href="https://github.com/dongitran/tgcodex">
    <img src="https://img.shields.io/github/stars/dongitran/tgcodex?style=social" alt="GitHub Stars">
  </a>
  <a href="https://www.npmjs.com/package/tgcodex">
    <img src="https://img.shields.io/npm/v/tgcodex?color=cb3837&logo=npm" alt="npm version">
  </a>
  <a href="https://github.com/dongitran/tgcodex/releases">
    <img src="https://img.shields.io/github/v/release/dongitran/tgcodex?include_prereleases&sort=semver" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-333333?logo=apple" alt="Platforms">
  <img src="https://img.shields.io/github/license/dongitran/tgcodex" alt="License">
</p>

<p align="center">
  <strong>Turn your Telegram groups into a powerful, AI-native personal knowledge base — directly from your terminal.</strong>
</p>

<p align="center">
  Professional CLI + gorgeous Ink TUI.<br>
  Authenticate with your real Telegram account → intelligently search & analyze across groups → export perfect context packs for <strong>OpenAI Codex</strong>, Claude Code, Gemini CLI, or any agent.
</p>

<p align="center">
  <a href="#installation">Install</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#how-it-works">How it Works</a>
</p>

---

## Why tgcodex?

Your Telegram groups are a goldmine of decisions, deals, technical discussions, and context — but they're impossible to search or synthesize at scale.

**tgcodex** solves this elegantly:

- Uses real MTProto (full access to *your* groups, not limited like bots)
- Leverages Telegram's own powerful server-side search
- Curates high-signal context with direct deep links back to messages
- Produces **research packs** that your favorite coding/research agent (Codex, Claude, etc.) can deeply reason over
- Beautiful, keyboard-driven TUI for daily use
- Everything stays local. Full encryption for your session.

Built by a senior fullstack developer, for senior developers who live in Telegram + terminal + AI agents.

---

## Installation

### Recommended: npm (Node 20+)

```bash
npm install -g tgcodex
```

or

```bash
pnpm add -g tgcodex
```

### From GitHub Releases (standalone binaries)

Download the latest release for your platform from [Releases](https://github.com/dongitran/tgcodex/releases):

- `tgcodex-macos-arm64`
- `tgcodex-macos-x64`
- `tgcodex-linux-x64`
- `tgcodex-linux-arm64`
- `tgcodex-win-x64.exe`

Then:

```bash
# macOS / Linux example
chmod +x tgcodex-macos-arm64
sudo mv tgcodex-macos-arm64 /usr/local/bin/tgcodex

tgcodex --version
```

A one-liner installer will be provided in future releases.

### From Source (for development / latest)

```bash
git clone https://github.com/dongitran/tgcodex.git
cd tgcodex
pnpm install
pnpm build
pnpm link --global   # or use ./dist/cli.js directly
```

---

## Quick Start

```bash
# 1. Login with your Telegram account (first time only)
tgcodex login

# 2. Explore your groups
tgcodex groups

# 3. Run research (the magic)
tgcodex scan \
  --query "tìm thông tin về deal với công ty X, deadline, người phụ trách" \
  --groups "work,investors" \
  --since 90d

# 4. Open the generated pack and let Codex go wild
cd ~/tgcodex-research/2026-06-...
codex
```

Or launch the beautiful interactive TUI:

```bash
tgcodex
```

---

## Features

- **Real Telegram user account** via MTProto (gramjs) — full history access
- **Smart retrieval** — Telegram server-side search + context window + thread fetching + deduplication
- **Perfect context packs** — `MISSION.md` + curated `SOURCES/` with timestamps and `t.me` deep links that agents love
- **Security first** — AES-256-GCM encrypted sessions, hardened command execution, read-only by design
- **Incremental & resumable** — remembers last scanned message per group
- **Professional TUI** (Ink) — fuzzy search, multi-select groups, live progress, beautiful output
- **Agent-agnostic** — works great with Codex, Claude Code, Gemini, Aider, or any local LLM tool
- **Vietnamese-first UX** with full English support
- **Cross-platform** — macOS, Linux, Windows

---

## Usage

### Core Commands

| Command            | Description                              |
|--------------------|------------------------------------------|
| `tgcodex`          | Launch interactive TUI (recommended)     |
| `tgcodex login`    | Authenticate (phone + code + 2FA)        |
| `tgcodex logout`   | Remove local encrypted session           |
| `tgcodex groups`   | List / search your groups and channels   |
| `tgcodex scan`     | Run research + export Codex-ready pack   |
| `tgcodex --help`   | Full help                                |

See `tgcodex scan --help` for powerful options (`--since`, `--max-per-group`, `--export-only`, etc.).

### Research Pack Structure (what gets created)

```
~/tgcodex-research/2026-06-02-deal-x-abc12/
├── MISSION.md          # Your goal + strict instructions for the AI
├── METADATA.json
├── SOURCES/
│   ├── work-group.md
│   └── investors-chat.md
└── RUN_CODEX.sh
```

Just `cd` in and run `codex` (or your agent of choice).

---

## How It Works

1. You authenticate once (standard Telegram login flow — api_id + api_hash + phone).
2. Session is encrypted at rest with a passphrase you control.
3. When you run a scan:
   - Uses Telegram's excellent `messages.search` (server-side, fast, relevant)
   - Fetches surrounding context + replies
   - Builds clean, linked Markdown files
   - Packages everything with a strong system prompt tuned for analysis
4. You (or the tool in assisted mode) point Codex at the pack.

No data leaves your machine except to Telegram (for fetching) and to your AI provider (only what you choose to send).

---

## Configuration

tgcodex stores config in `~/.config/tgcodex/` (or `$XDG_CONFIG_HOME`).

You can override research output directory and AI command via the config file or environment (see `tgcodex config` in future versions).

---

## Security & Privacy

- Your Telegram session is **encrypted** (AES-256-GCM) with a passphrase.
- The tool is **read-only** — it will never send messages or join groups on your behalf.
- All analysis happens locally or through *your* AI agent.
- Review every research pack before feeding it to an agent.

See [SECURITY.md](./SECURITY.md) for full details.

**Use responsibly.** Respect the privacy of people in your groups and Telegram's Terms of Service.

---

## Development

```bash
pnpm install
pnpm dev -- --help          # run without building
pnpm typecheck
pnpm test
pnpm build
```

We follow strict TypeScript, conventional commits, and high test coverage on core logic (crypto, packing, etc.).

---

## Roadmap

- [ ] Full interactive TUI with live scanning and follow-up questions
- [ ] Real retrieval pipeline (currently demo pack creation works; full search coming)
- [ ] Prebuilt binaries + one-line installer in releases
- [ ] Support for multiple AI CLIs out of the box (Codex, Claude Code, Gemini, Ollama, etc.)
- [ ] Background watch mode + notifications
- [ ] Export to Obsidian / Logseq / Markdown knowledge bases

---

## Contributing

Contributions are welcome! Especially:

- TUI improvements (Ink components)
- Better retrieval & chunking strategies
- Additional AI adapter integrations
- Documentation & examples (especially Vietnamese use cases)

Please open an issue first for larger changes.

---

## License

MIT © Dong Tran

---

## Acknowledgments

- [gramjs](https://github.com/gram-js/gramjs) for excellent MTProto client
- [Ink](https://github.com/vadimdemedes/ink) for React in the terminal
- OpenAI Codex team for the incredible agentic CLI
- The many high-quality CLI tools in the ecosystem that set the bar for professionalism

---

<p align="center">
  <strong>Stop losing context in Telegram. Start synthesizing it.</strong>
</p>

<p align="center">
  <a href="https://github.com/dongitran/tgcodex">Star on GitHub</a> •
  <a href="https://github.com/dongitran/tgcodex/releases">Download latest release</a>
</p>
