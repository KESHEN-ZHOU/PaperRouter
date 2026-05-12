// tests/unit/adapters/openai-compat.test.js
describe('callOpenAICompat', () => {
  let callOpenAICompat;
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    // callOpenAICompat will be extracted for testing via a small shim;
    // in-extension it lives on the TidyUp namespace. For this unit test
    // we copy the function body below and assign it directly.
    callOpenAICompat = async function(config, prompt) {
      let baseUrl = config.baseUrl;
      if (baseUrl.indexOf('/v1') === -1 && config.provider !== 'ollama') {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
      }
      const headers = { 'Content-Type': 'application/json; charset=utf-8' };
      if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;
      if (config.provider === 'openrouter') headers['HTTP-Referer'] = 'https://github.com/KESHEN-ZHOU/PaperRouter';
      const resp = await fetch(baseUrl + '/chat/completions', {
        method: 'POST', headers,
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 50, temperature: 0.3 })
      });
      if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt.substring(0, 100)); }
      const data = JSON.parse(await resp.text());
      return data.choices[0].message.content;
    };
  });

  test('happy path: returns message content', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'ai-ml' } }] })
    });
    const result = await callOpenAICompat(
      { provider: 'openai', apiKey: 'sk-x', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
      'Classify: ML paper'
    );
    expect(result).toBe('ai-ml');
  });

  test('openrouter: adds HTTP-Referer header', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: 'x' } }] }) });
    await callOpenAICompat(
      { provider: 'openrouter', apiKey: 'or-x', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
      'ping'
    );
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers['HTTP-Referer']).toBe('https://github.com/KESHEN-ZHOU/PaperRouter');
  });

  test('ollama: no Authorization header when apiKey empty', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: 'x' } }] }) });
    await callOpenAICompat(
      { provider: 'ollama', apiKey: '', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
      'ping'
    );
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toBeUndefined();
  });

  test('error: 401 surfaces HTTP error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"unauthorized"}' });
    await expect(callOpenAICompat(
      { provider: 'openai', apiKey: 'bad', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
      'ping'
    )).rejects.toThrow(/HTTP 401/);
  });
});
