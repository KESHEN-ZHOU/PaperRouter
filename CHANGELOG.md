# Changelog

## 0.2.1 — 2026-05-26

Bug fix.

### Fixed

- **Classifying a sub-item now works.** Selecting a child attachment (Preprint PDF, Snapshot) or note and clicking classify used to give inaccurate suggestions and fail with a foreign-key error (child items can't belong to a collection). The selection now resolves to its top-level paper before classifying and filing, so clicking a sub-item behaves the same as clicking the item itself.

## 0.2.0 — 2026-05-17

First polished release. UI refinements, infrastructure work, and the start of auto-update support.

### New

- **Auto-update channel.** Zotero now checks for new versions automatically. Future releases install in-place from the Add-ons panel without re-downloading the xpi manually.

### Improved

- Suggestion dialog: tighter selection behavior, more predictable timing during the initial recommendation pass.
- README: project rationale, version/license badges, public roadmap.

### Internal

- Test suite runs on every pull request via GitHub Actions.

See [README → Roadmap](README.md#roadmap) for what is planned next.

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
