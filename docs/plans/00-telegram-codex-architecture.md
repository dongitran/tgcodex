# Architecture Plan — tg-codex (27-telegram-codex)

(Stub created during Phase 1-2. Expand with full decisions tables, Mermaid flows, data models as implementation progresses.)

## Goals
- Professional, secure, delightful terminal tool for personal Telegram group intelligence.
- Primary output: high-quality research packs optimized for Codex CLI (and other agents).
- Read-only, privacy-first, rate-limit resilient.

## Key Decisions (from approved plan + research)
- Commander + Ink (sapbruno as closest analog in repo)
- gramjs for Telegram (battle-tested user MTProto)
- AES-256-GCM + passphrase (or future keychain)
- JSON store first (native sqlite build issues on this env; migrate later)
- Pack export as the 80/20 killer feature
- Hardened spawn only as optional (security.ts patterns from bitwarden)

## Layers
- cli.ts (Commander)
- commands/ (thin)
- services/ (config, crypto, storage, telegram, research/*, ai/*)
- tui/ (Ink)

## Research Pipeline (to be fully implemented)
1. Query understanding (optional)
2. Retrieval (search first + history)
3. Enrich + linkify (t.me deep links mandatory)
4. Pack (MISSION + SOURCES/ + metadata + RUN helper)
5. Execute (export or spawn)

## Next
See root plan.md in the session for phased implementation details.

This document will become the living architecture reference (like url-shortener's big plan).
