// tests/fixtures/providers-expected.js
// Canonical shape that PaperRouter/chrome/content/providers.js must satisfy.
const LLM_PROVIDERS_KEYS = ['anthropic', 'cohere', 'custom', 'gemini', 'openai', 'openrouter'];
const EMBEDDING_PROVIDERS_KEYS = ['cohere', 'custom', 'openai'];

module.exports = { LLM_PROVIDERS_KEYS, EMBEDDING_PROVIDERS_KEYS };
