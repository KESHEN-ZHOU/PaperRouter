// tests/unit/adapters/anthropic.test.js
describe('callAnthropic', () => {
  let callAnthropic;
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    callAnthropic = async function(config, prompt) {
      const baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
      const resp = await fetch(baseUrl + '/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 100,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt.substring(0, 100)); }
      const data = JSON.parse(await resp.text());
      return data.content[0].text;
    };
  });

  test('happy path', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ content: [{ type: 'text', text: 'ai-ml' }] })
    });
    const result = await callAnthropic(
      { apiKey: 'sk-ant-x', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
      'classify'
    );
    expect(result).toBe('ai-ml');
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers['x-api-key']).toBe('sk-ant-x');
    expect(call[1].headers['anthropic-version']).toBe('2023-06-01');
  });

  test('error: 400 surfaces HTTP error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"bad request"}' });
    await expect(callAnthropic(
      { apiKey: 'x', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
      'ping'
    )).rejects.toThrow(/HTTP 400/);
  });
});
