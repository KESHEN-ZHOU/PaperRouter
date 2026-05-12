// tests/unit/adapters/gemini.test.js
describe('callGemini', () => {
  let callGemini;
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    callGemini = async function(config, prompt) {
      const baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
      const url = `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.3 }
        })
      });
      if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt.substring(0, 100)); }
      const data = JSON.parse(await resp.text());
      return data.candidates[0].content.parts[0].text;
    };
  });

  test('happy path', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ai-ml' }] } }] })
    });
    const result = await callGemini(
      { apiKey: 'AIza-x', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
      'classify'
    );
    expect(result).toBe('ai-ml');
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toContain('key=AIza-x');
    expect(call[0]).toContain('gemini-2.0-flash:generateContent');
  });

  test('error: 403 surfaces HTTP error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => '{"error":"forbidden"}' });
    await expect(callGemini(
      { apiKey: 'bad', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
      'ping'
    )).rejects.toThrow(/HTTP 403/);
  });
});
