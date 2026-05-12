// tests/unit/providers.test.js
// 3.0.5: tests run against the real IIFE module via vm sandbox loader.
const { loadProviders } = require('../helpers/load-providers');
const { LLM_PROVIDERS_KEYS, EMBEDDING_PROVIDERS_KEYS } = require('../fixtures/providers-expected');

describe('providers.js IIFE shape', () => {
  let P;
  beforeAll(() => { P = loadProviders(); });

  test('LLM_PROVIDERS contains the expected entries (Cohere added, Ollama removed)', () => {
    expect(Object.keys(P.LLM_PROVIDERS).sort()).toEqual(LLM_PROVIDERS_KEYS);
  });

  test('EMBEDDING_PROVIDERS contains the expected entries (Ollama removed)', () => {
    expect(Object.keys(P.EMBEDDING_PROVIDERS).sort()).toEqual(EMBEDDING_PROVIDERS_KEYS);
  });

  test('every LLM provider has displayName, defaultBaseUrl, defaultModel, recommendedModels, modelClasses', () => {
    for (var key of Object.keys(P.LLM_PROVIDERS)) {
      const cfg = P.LLM_PROVIDERS[key];
      expect(typeof cfg.displayName).toBe('string');
      expect(typeof cfg.defaultBaseUrl).toBe('string');
      expect(Array.isArray(cfg.recommendedModels)).toBe(true);
      expect(Array.isArray(cfg.modelClasses)).toBe(true);
      expect(cfg.modelClasses.length).toBeGreaterThan(0);
      for (var c of cfg.modelClasses) {
        // vm-cross-realm safe: `instanceof RegExp` fails when regex is created in sandbox.
        expect(Object.prototype.toString.call(c.match)).toBe('[object RegExp]');
        expect(typeof c.kind).toBe('string');
      }
      if (key !== 'custom') expect(cfg.recommendedModels.length).toBeGreaterThan(0);
    }
  });

  test('public API surface', () => {
    expect(typeof P.classify).toBe('function');
    expect(typeof P.buildOpenAIRequest).toBe('function');
    expect(typeof P.buildAnthropicRequest).toBe('function');
    expect(typeof P.buildGeminiRequest).toBe('function');
    expect(typeof P.buildCohereRequest).toBe('function');
    expect(typeof P.parseChatResponse).toBe('function');
    expect(typeof P.parseErrorBody).toBe('function');
  });
});

describe('classify(provider, model)', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('OpenAI gpt-5 → reasoning_openai',         () => expect(P.classify('openai', 'gpt-5')).toBe('reasoning_openai'));
  test('OpenAI gpt-5-mini → reasoning_openai',    () => expect(P.classify('openai', 'gpt-5-mini')).toBe('reasoning_openai'));
  test('OpenAI gpt-4.1 → plain_openai',           () => expect(P.classify('openai', 'gpt-4.1')).toBe('plain_openai'));
  test('OpenAI gpt-4o-mini → plain_openai',       () => expect(P.classify('openai', 'gpt-4o-mini')).toBe('plain_openai'));
  test('Anthropic claude-3-5-haiku → plain_anthropic',     () => expect(P.classify('anthropic', 'claude-3-5-haiku-latest')).toBe('plain_anthropic'));
  test('Anthropic claude-sonnet-4-6 → reasoning_anthropic',() => expect(P.classify('anthropic', 'claude-sonnet-4-6')).toBe('reasoning_anthropic'));
  test('Gemini gemini-2.0-flash → plain_gemini (legacy fallthrough)', () => expect(P.classify('gemini', 'gemini-2.0-flash')).toBe('plain_gemini'));
  test('Gemini gemini-2.5-flash → reasoning_gemini',       () => expect(P.classify('gemini', 'gemini-2.5-flash')).toBe('reasoning_gemini'));
  test('Gemini gemini-2.5-flash-lite → reasoning_gemini',  () => expect(P.classify('gemini', 'gemini-2.5-flash-lite')).toBe('reasoning_gemini'));
  test('Gemini default model is gemini-2.5-flash-lite',    () => expect(P.LLM_PROVIDERS.gemini.defaultModel).toBe('gemini-2.5-flash-lite'));
  test('OpenRouter openai/gpt-5 → reasoning_openai',           () => expect(P.classify('openrouter', 'openai/gpt-5')).toBe('reasoning_openai'));
  test('OpenRouter anthropic/claude-sonnet-4 → reasoning_anthropic', () => expect(P.classify('openrouter', 'anthropic/claude-sonnet-4-6')).toBe('reasoning_anthropic'));
  test('OpenRouter openai/gpt-4o-mini → plain_openai',         () => expect(P.classify('openrouter', 'openai/gpt-4o-mini')).toBe('plain_openai'));
  test('OpenRouter deepseek/deepseek-v4-flash → plain_openai', () => expect(P.classify('openrouter', 'deepseek/deepseek-v4-flash')).toBe('plain_openai'));
  test('OpenRouter moonshotai/kimi-k2.5 → plain_openai',       () => expect(P.classify('openrouter', 'moonshotai/kimi-k2.5')).toBe('plain_openai'));
  test('OpenRouter default model is deepseek/deepseek-v4-flash', () => expect(P.LLM_PROVIDERS.openrouter.defaultModel).toBe('deepseek/deepseek-v4-flash'));
  test('Cohere command-r-plus → plain_cohere',                 () => expect(P.classify('cohere', 'command-r-plus')).toBe('plain_cohere'));
  test('Custom anything → plain_openai',                       () => expect(P.classify('custom', 'whatever')).toBe('plain_openai'));
  test('Unknown provider → null',                              () => expect(P.classify('mysteryai', 'foo')).toBeNull());
});

describe('buildOpenAIRequest', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('GPT-4.1 (plain): max_tokens=200 runtime, temperature=0.3, no max_completion_tokens, no reasoning_effort', () => {
    const r = P.buildOpenAIRequest({ provider:'openai', model:'gpt-4.1', apiKey:'sk-x', baseUrl:'https://api.openai.com/v1' }, 'hi', false);
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(r.headers['Authorization']).toBe('Bearer sk-x');
    expect(r.body.max_tokens).toBe(200);
    expect(r.body.temperature).toBe(0.3);
    expect(r.body.max_completion_tokens).toBeUndefined();
    expect(r.body.reasoning_effort).toBeUndefined();
  });

  test('GPT-5 (reasoning): max_completion_tokens=4000 runtime, reasoning_effort=minimal, no max_tokens, no temperature', () => {
    const r = P.buildOpenAIRequest({ provider:'openai', model:'gpt-5', apiKey:'sk-x', baseUrl:'https://api.openai.com/v1' }, 'hi', false);
    expect(r.body.max_completion_tokens).toBe(4000);
    expect(r.body.reasoning_effort).toBe('minimal');
    expect(r.body.max_tokens).toBeUndefined();
    expect(r.body.temperature).toBeUndefined();
  });

  test('isTest=true uses smaller test budget', () => {
    const plain = P.buildOpenAIRequest({ provider:'openai', model:'gpt-4.1', apiKey:'sk-x', baseUrl:'https://api.openai.com/v1' }, 'hi', true);
    const reasoning = P.buildOpenAIRequest({ provider:'openai', model:'gpt-5', apiKey:'sk-x', baseUrl:'https://api.openai.com/v1' }, 'hi', true);
    expect(plain.body.max_tokens).toBe(20);
    expect(reasoning.body.max_completion_tokens).toBe(2000);
  });

  test('OpenRouter sets HTTP-Referer; openai/gpt-5 → reasoning path', () => {
    const r = P.buildOpenAIRequest({ provider:'openrouter', model:'openai/gpt-5', apiKey:'sk-or', baseUrl:'https://openrouter.ai/api/v1' }, 'hi', false);
    expect(r.headers['HTTP-Referer']).toMatch(/PaperRouter/);
    expect(r.body.max_completion_tokens).toBe(4000);
    expect(r.body.reasoning_effort).toBe('minimal');
  });

  test('baseUrl missing /v1 gets one appended (except ollama)', () => {
    const r = P.buildOpenAIRequest({ provider:'custom', model:'foo', apiKey:'k', baseUrl:'https://my-llm.example.com' }, 'hi', false);
    expect(r.url).toBe('https://my-llm.example.com/v1/chat/completions');
  });

  test('messages have role:user and the prompt', () => {
    const r = P.buildOpenAIRequest({ provider:'openai', model:'gpt-4.1', apiKey:'sk', baseUrl:'https://api.openai.com/v1' }, 'PROMPT_TEXT', false);
    expect(r.body.messages).toEqual([{ role: 'user', content: 'PROMPT_TEXT' }]);
  });
});

describe('buildAnthropicRequest', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('Haiku 3.5 (plain): max_tokens=300 runtime, no thinking field', () => {
    const r = P.buildAnthropicRequest({ provider:'anthropic', model:'claude-3-5-haiku-latest', apiKey:'sk-ant', baseUrl:'https://api.anthropic.com/v1' }, 'hi', false);
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe('sk-ant');
    expect(r.headers['anthropic-version']).toBe('2023-06-01');
    expect(r.body.max_tokens).toBe(300);
    expect(r.body.thinking).toBeUndefined();
  });

  test('Sonnet 4.6 (reasoning): thinking={type:"disabled"}, max_tokens=4000 runtime', () => {
    const r = P.buildAnthropicRequest({ provider:'anthropic', model:'claude-sonnet-4-6', apiKey:'sk-ant', baseUrl:'https://api.anthropic.com/v1' }, 'hi', false);
    expect(r.body.thinking).toEqual({ type: 'disabled' });
    expect(r.body.max_tokens).toBe(4000);
  });

  test('isTest=true uses smaller test budget', () => {
    const plain = P.buildAnthropicRequest({ provider:'anthropic', model:'claude-3-5-haiku-latest', apiKey:'sk', baseUrl:'https://api.anthropic.com/v1' }, 'hi', true);
    expect(plain.body.max_tokens).toBe(20);
    const reasoning = P.buildAnthropicRequest({ provider:'anthropic', model:'claude-sonnet-4-6', apiKey:'sk', baseUrl:'https://api.anthropic.com/v1' }, 'hi', true);
    expect(reasoning.body.max_tokens).toBe(2000);
  });
});

describe('buildGeminiRequest', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('AI Studio key (AIza...) routes to generativelanguage.googleapis.com', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.0-flash', apiKey:'AIza_test', baseUrl:'https://generativelanguage.googleapis.com/v1beta' }, 'hi', false);
    expect(r.url).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.0-flash:generateContent\?key=AIza_test/);
  });

  test('Vertex Express key (AQ....) routes to aiplatform.googleapis.com', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.0-flash', apiKey:'AQ.test', baseUrl:'https://generativelanguage.googleapis.com/v1beta' }, 'hi', false);
    expect(r.url).toMatch(/aiplatform\.googleapis\.com\/v1\/publishers\/google\/models\/gemini-2\.0-flash:generateContent\?key=AQ\.test/);
  });

  test('explicit non-default baseUrl overrides auto-detection', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.0-flash', apiKey:'AQ.test', baseUrl:'https://my-proxy.example/v1beta' }, 'hi', false);
    expect(r.url).toMatch(/^https:\/\/my-proxy\.example\/v1beta\/models\//);
  });

  test('Gemini 2.5 Flash (reasoning): thinkingConfig.thinkingBudget === 0', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.5-flash', apiKey:'AIza_x', baseUrl:'https://generativelanguage.googleapis.com/v1beta' }, 'hi', false);
    expect(r.body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(r.body.generationConfig.maxOutputTokens).toBe(4000);
  });

  test('Gemini 2.0 Flash (plain): no thinkingConfig, maxOutputTokens=200 runtime', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.0-flash', apiKey:'AIza_x', baseUrl:'https://generativelanguage.googleapis.com/v1beta' }, 'hi', false);
    expect(r.body.generationConfig.thinkingConfig).toBeUndefined();
    expect(r.body.generationConfig.maxOutputTokens).toBe(200);
    expect(r.body.generationConfig.temperature).toBe(0.3);
  });

  test('contents has parts with prompt text', () => {
    const r = P.buildGeminiRequest({ provider:'gemini', model:'gemini-2.0-flash', apiKey:'AIza_x', baseUrl:'https://generativelanguage.googleapis.com/v1beta' }, 'PROMPT_X', false);
    expect(r.body.contents).toEqual([{ parts: [{ text: 'PROMPT_X' }] }]);
  });
});

describe('buildCohereRequest', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('command-r-plus: POST /chat with bearer + max_tokens=200', () => {
    const r = P.buildCohereRequest({ provider:'cohere', model:'command-r-plus', apiKey:'co-x', baseUrl:'https://api.cohere.ai/v1' }, 'hi', false);
    expect(r.url).toBe('https://api.cohere.ai/v1/chat');
    expect(r.headers['Authorization']).toBe('Bearer co-x');
    expect(r.body.model).toBe('command-r-plus');
    expect(r.body.message).toBe('hi');
    expect(r.body.max_tokens).toBe(200);
    expect(r.body.temperature).toBe(0.3);
  });

  test('isTest=true uses smaller test budget', () => {
    const r = P.buildCohereRequest({ provider:'cohere', model:'command-r-plus', apiKey:'co-x', baseUrl:'https://api.cohere.ai/v1' }, 'hi', true);
    expect(r.body.max_tokens).toBe(20);
  });

  test('baseUrl missing /v1 gets one appended', () => {
    const r = P.buildCohereRequest({ provider:'cohere', model:'command-r-plus', apiKey:'co-x', baseUrl:'https://api.cohere.ai' }, 'hi', false);
    expect(r.url).toBe('https://api.cohere.ai/v1/chat');
  });
});

describe('parseChatResponse', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('OpenAI normal: returns content, error null', () => {
    const data = { choices: [{ message: { content: 'external' }, finish_reason: 'stop' }] };
    expect(P.parseChatResponse('openai', 'plain_openai', data)).toEqual({ content: 'external', error: null });
  });

  test('OpenAI finish_reason=length + empty content → error=empty_truncated', () => {
    const data = { choices: [{ message: { content: '' }, finish_reason: 'length' }] };
    expect(P.parseChatResponse('openai', 'reasoning_openai', data)).toEqual({ content: null, error: 'empty_truncated' });
  });

  test('OpenRouter same shape as OpenAI', () => {
    const data = { choices: [{ message: { content: 'foo' }, finish_reason: 'stop' }] };
    expect(P.parseChatResponse('openrouter', 'plain_openai', data)).toEqual({ content: 'foo', error: null });
  });

  test('Anthropic normal: returns text', () => {
    const data = { content: [{ text: 'internal' }], stop_reason: 'end_turn' };
    expect(P.parseChatResponse('anthropic', 'plain_anthropic', data)).toEqual({ content: 'internal', error: null });
  });

  test('Anthropic stop_reason=max_tokens + empty text → error=empty_truncated', () => {
    const data = { content: [{ text: '' }], stop_reason: 'max_tokens' };
    expect(P.parseChatResponse('anthropic', 'reasoning_anthropic', data)).toEqual({ content: null, error: 'empty_truncated' });
  });

  test('Gemini normal: returns text from parts[0]', () => {
    const data = { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }] };
    expect(P.parseChatResponse('gemini', 'plain_gemini', data)).toEqual({ content: 'x', error: null });
  });

  test('Gemini MAX_TOKENS + missing text → error=empty_truncated', () => {
    const data = { candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] };
    expect(P.parseChatResponse('gemini', 'reasoning_gemini', data)).toEqual({ content: null, error: 'empty_truncated' });
  });

  test('Cohere returns top-level text', () => {
    expect(P.parseChatResponse('cohere', 'plain_cohere', { text: 'ok' })).toEqual({ content: 'ok', error: null });
  });

  // 3.0.6: HTTP-200-but-empty paths now surface a specific error string instead of returning silently.
  test('OpenAI empty content + non-length finish_reason → error includes finish reason', () => {
    const data = { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] };
    expect(P.parseChatResponse('openai', 'plain_openai', data)).toEqual({
      content: null, error: 'Empty response (finish: content_filter)'
    });
  });

  test('OpenAI no choices → error', () => {
    expect(P.parseChatResponse('openai', 'plain_openai', { choices: [] })).toEqual({
      content: null, error: 'Empty response (no choices)'
    });
  });

  test('Anthropic empty text + non-max_tokens stop_reason → error includes stop reason', () => {
    const data = { content: [{ text: '' }], stop_reason: 'refusal' };
    expect(P.parseChatResponse('anthropic', 'plain_anthropic', data)).toEqual({
      content: null, error: 'Empty response (stop: refusal)'
    });
  });

  test('Gemini promptFeedback.blockReason → error mentions safety block', () => {
    const data = { promptFeedback: { blockReason: 'SAFETY' } };
    expect(P.parseChatResponse('gemini', 'plain_gemini', data)).toEqual({
      content: null, error: 'Blocked by safety: SAFETY'
    });
  });

  test('Gemini empty text + non-MAX_TOKENS finishReason → error includes finish reason', () => {
    const data = { candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'RECITATION' }] };
    expect(P.parseChatResponse('gemini', 'plain_gemini', data)).toEqual({
      content: null, error: 'Empty response (finish: RECITATION)'
    });
  });

  test('Cohere missing text → error', () => {
    expect(P.parseChatResponse('cohere', 'plain_cohere', {})).toEqual({
      content: null, error: 'Empty response (no text)'
    });
  });

  test('Malformed data: null/garbage still does not throw, error populated', () => {
    expect(P.parseChatResponse('openai', 'plain_openai', null).content).toBeNull();
    expect(P.parseChatResponse('openai', 'plain_openai', null).error).toMatch(/empty/i);
    expect(P.parseChatResponse('openai', 'plain_openai', { weird: 1 }).error).toMatch(/empty/i);
  });
});

describe('parseErrorBody', () => {
  let P; beforeAll(() => { P = loadProviders(); });

  test('401 → err-invalid-key', () => {
    expect(P.parseErrorBody('openai', 401, '{}')).toBe('err-invalid-key');
  });
  test('403 → err-invalid-key', () => {
    expect(P.parseErrorBody('openai', 403, '{}')).toBe('err-invalid-key');
  });
  test('429 → err-rate-limited', () => {
    expect(P.parseErrorBody('openai', 429, '{}')).toBe('err-rate-limited');
  });
  test('404 → err-model-unavailable', () => {
    expect(P.parseErrorBody('openai', 404, '{}')).toBe('err-model-unavailable');
  });
  test('OpenAI 400 + error.code=model_not_found → err-model-unavailable', () => {
    const body = JSON.stringify({ error: { code: 'model_not_found', message: 'x' } });
    expect(P.parseErrorBody('openai', 400, body)).toBe('err-model-unavailable');
  });
  test('OpenAI 400 + error.code=invalid_api_key → err-invalid-key', () => {
    const body = JSON.stringify({ error: { code: 'invalid_api_key', message: 'x' } });
    expect(P.parseErrorBody('openai', 400, body)).toBe('err-invalid-key');
  });
  test('Anthropic 400 + error.type=not_found_error → err-model-unavailable', () => {
    const body = JSON.stringify({ error: { type: 'not_found_error' } });
    expect(P.parseErrorBody('anthropic', 400, body)).toBe('err-model-unavailable');
  });
  test('Gemini 400 + error.status=UNAUTHENTICATED → err-invalid-key', () => {
    const body = JSON.stringify({ error: { status: 'UNAUTHENTICATED' } });
    expect(P.parseErrorBody('gemini', 400, body)).toBe('err-invalid-key');
  });
  test('Unknown 500 with no parseable body → err-http-generic with status param', () => {
    expect(P.parseErrorBody('openai', 500, 'something went wrong')).toBe('err-http-generic|status=500');
  });
  test('Unknown 500 with parseable code → err-http-generic with status + code suffix', () => {
    const body = JSON.stringify({ error: { code: 'server_error' } });
    expect(P.parseErrorBody('openai', 500, body)).toBe('err-http-generic|status=500 (server_error)');
  });
});
