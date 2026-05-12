// tests/fixtures/providers-expected.js
// Canonical shape that PaperRouter/chrome/content/providers.js must satisfy.
// 3.0.6: Gemini removed from EMBEDDING (text-embedding-004 deprecated; OpenAI-compatible covers it).
// 3.0.5: Cohere added to LLM; Ollama commented out on both; modelClasses regex routing per provider.
const LLM_PROVIDERS_KEYS = ['anthropic', 'cohere', 'custom', 'gemini', 'openai', 'openrouter'];
const EMBEDDING_PROVIDERS_KEYS = ['cohere', 'custom', 'openai'];

module.exports = { LLM_PROVIDERS_KEYS, EMBEDDING_PROVIDERS_KEYS };
