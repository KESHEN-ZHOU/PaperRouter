const mockApi = {
  embedding: {
    openai: [0.1, 0.2, 0.3, 0.4],
    cohere: [0.5, 0.6, 0.7, 0.8]
  },
  
  llm: {
    openai: '外在描述型',
    cohere: '内在含义型'
  },
  
  getEmbedding: function(provider) {
    return this.embedding[provider] || [];
  },
  
  getLlmResponse: function(provider) {
    return this.llm[provider] || '';
  },
  
  mockOpenAIEmbedding: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3, 0.4])),
  mockCohereEmbedding: jest.fn(() => Promise.resolve([0.5, 0.6, 0.7, 0.8])),
  mockOpenAILlm: jest.fn(() => Promise.resolve('外在描述型')),
  mockCohereLlm: jest.fn(() => Promise.resolve('内在含义型'))
};

global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: async () => ({
    choices: [{
      message: {
        content: 'Test response'
      }
    }]
  })
}));

module.exports = mockApi;
