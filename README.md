<div align="center">

# PaperRouter

A Zotero plugin that suggests which collections a paper belongs to.

[English](./README.md) · [简体中文](./README.zh-CN.md)

![PaperRouter collections dialog](assets/screenshot.png)

</div>

---

## What it does

Right-click an item in Zotero, get a ranked list of collections with a confidence score next to each, pick the ones that fit. PaperRouter also remembers what you reject: blacklisted collections get penalised in future suggestions.

Works on Zotero 7, 8, and 9.

## Features

- Two ranking modes: embedding cosine similarity, or LLM zero-shot classification.
- Per-collection confidence score shown in the dialog.
- Feedback-aware: rejected collections are blacklisted and down-ranked next time.
- Hierarchy-aware: doesn't suggest a child collection when the parent is already a strong match.
- Keyword filter inside the dialog.
- Configurable cap (default 4 collections per item) and a confidence-threshold slider.
- Background embedding refresh on startup so the dialog opens fast.
- UI in English, 简体中文, 繁體中文, with auto-detect.

## How it works

Two algorithms; you can use either or both:

1. **Embedding cosine similarity.** Calls an embedding API, scores collections by vector angle, applies IDF weighting and a depth/specificity penalty.
2. **LLM zero-shot.** Sends all collection names to an LLM in one prompt and parses the ranked output with confidence scores.

## Requirements

- [Zotero](https://www.zotero.org/) 7.x – 9.x
- An API key for at least one provider:
  - LLM: OpenAI, Anthropic (Claude), Gemini, OpenRouter, Cohere, or any OpenAI-compatible endpoint.
  - Embedding: OpenAI, Cohere, or any OpenAI-compatible endpoint.

Both sides are independent. You can configure embedding only, LLM only, or both.

## Install

1. Grab `paperrouter-*.xpi` from [Releases](../../releases), or use `dist/paperrouter-0.0.2.xpi` from this repo.
2. Zotero → Tools → Add-ons → ⚙️ → Install Add-on From File…
3. Pick the `.xpi`, restart Zotero.

### Build from source

```bash
npm ci
npm test
./scripts/build-xpi.sh
```

## Configuration

Open **Edit → Settings → PaperRouter** and configure at least one side:

- **Embedding** — pick a provider, paste an API key, pick or type a model, click Test.
- **LLM** — same flow.

Each provider's API key and model are saved independently, so switching providers won't overwrite anything you've already set.

## Usage

- Right-click any item → **Send to Collection…**
- Or click the PaperRouter icon in the Zotero toolbar.

Inside the dialog:

- Pre-checked rows are the collections this item already belongs to (bold red).
- Drag the threshold slider to hide low-confidence suggestions.
- Click **Retry** to re-rank after blacklisting some, or **OK** to confirm.

## License

[MPL-2.0](./LICENSE).
