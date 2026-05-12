# PaperRouter — Tests

This directory contains the unit and integration tests for the PaperRouter Zotero plugin.

## Layout

```
tests/
├── setup.js                # Jest test environment setup
├── unit/                   # Unit tests
│   ├── cache.test.js
│   ├── classification.test.js
│   ├── config.test.js
│   ├── providers.test.js   # 55 cases covering the shared providers IIFE
│   ├── similarity.test.js
│   └── adapters/           # Per-provider request/response shape
│       ├── anthropic.test.js
│       ├── gemini.test.js
│       └── openai-compat.test.js
├── integration/            # Integration tests
│   ├── background-task.test.js
│   ├── blacklist.test.js
│   ├── collection-tree.test.js
│   ├── diversity.test.js
│   ├── embedding-api.test.js
│   ├── hierarchy.test.js
│   ├── idf-weighting.test.js
│   ├── llm-api.test.js
│   ├── specificity.test.js
│   └── v01-regression.test.js
├── mocks/                  # Shared mocks
│   ├── api.js
│   └── zotero.js
├── fixtures/
│   └── providers-expected.js
└── helpers/
    └── load-providers.js   # vm sandbox helper for loading the providers IIFE in Node
```

## Running

```bash
npm ci

npm test                 # all tests
npm test -- cache        # filter by filename
npm run test:watch       # watch mode
npm run test:coverage    # coverage report
```
