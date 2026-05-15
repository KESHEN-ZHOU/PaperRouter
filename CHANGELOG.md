# Changelog

## 0.0.2 — 2026-05-16

Pre-release audit fixes. **Upgrade from 0.0.1.x.**

- Embedding `baseUrl` no longer defaults to a third-party proxy. New default is `https://api.openai.com/v1`.
- `testMode.enabled` ships off. Previously capped background embedding refresh to 3 collections.

Known limitation: `applications.zotero.update_url` still points at a Zotero CDN sample (kept for Zotero 9 install compatibility); auto-update is not wired up. Will replace with a self-hosted `updates.json` next release.

## 0.0.1.1 — 2026-05-12

Fix Zotero 9 install. The 0.0.1 xpi was missing the
`applications.zotero.update_url` field, which Zotero 9 needs to accept the
install; restoring it makes the plugin install cleanly on 9.

## 0.0.1 — 2026-05-12

First public release. Installs on Zotero 7 and 8; superseded by 0.0.1.1
for Zotero 9.

- Two ranking modes: embedding similarity, LLM zero-shot.
- Confidence score per collection; rejected ones are blacklisted next run.
- Hierarchy-aware. Dialog has a keyword filter and threshold slider.
- Providers: OpenAI, Anthropic, Gemini, OpenRouter, Cohere, OpenAI-compatible.
- UI: English, 简体中文, 繁體中文.
