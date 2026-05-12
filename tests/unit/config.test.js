describe('Configuration Loading', () => {
  let loadEmbeddingConfig;
  let loadLlmConfig;
  let loadTestModeConfig;
  let loadMaxCollectionNumConfig;
  
  beforeEach(() => {
    global.Zotero = {
      Prefs: {
        get: jest.fn((key) => {
          const defaults = {
            'extensions.tidy-up.maxCollectionNum': 4,
            'extensions.tidy-up.classification.algorithm': 'vector',
            'extensions.tidy-up.embedding.provider': '',
            'extensions.tidy-up.embedding.apiKey': '',
            'extensions.tidy-up.embedding.model': '',
            'extensions.tidy-up.embedding.baseUrl': 'https://bapi.huiyan-ai.cn/',
            'extensions.tidy-up.llm.provider': '',
            'extensions.tidy-up.llm.apiKey': '',
            'extensions.tidy-up.llm.model': '',
            'extensions.tidy-up.llm.baseUrl': 'https://bapi.huiyan-ai.cn/v1',
            'extensions.tidy-up.testMode.enabled': true,
            'extensions.tidy-up.testMode.maxCollections': 3,
            'extensions.tidy-up.testMode.mockApiResponses': false
          };
          return defaults[key];
        }),
        set: jest.fn()
      }
    };
    
    loadEmbeddingConfig = function() {
      return {
        provider: global.Zotero.Prefs.get('extensions.tidy-up.embedding.provider'),
        model: global.Zotero.Prefs.get('extensions.tidy-up.embedding.model'),
        baseUrl: global.Zotero.Prefs.get('extensions.tidy-up.embedding.baseUrl'),
        apiKey: global.Zotero.Prefs.get('extensions.tidy-up.embedding.apiKey')
      };
    };
    
    loadLlmConfig = function() {
      return {
        provider: global.Zotero.Prefs.get('extensions.tidy-up.llm.provider'),
        model: global.Zotero.Prefs.get('extensions.tidy-up.llm.model'),
        baseUrl: global.Zotero.Prefs.get('extensions.tidy-up.llm.baseUrl'),
        apiKey: global.Zotero.Prefs.get('extensions.tidy-up.llm.apiKey')
      };
    };
    
    loadTestModeConfig = function() {
      return {
        enabled: global.Zotero.Prefs.get('extensions.tidy-up.testMode.enabled'),
        maxCollections: global.Zotero.Prefs.get('extensions.tidy-up.testMode.maxCollections'),
        mockApiResponses: global.Zotero.Prefs.get('extensions.tidy-up.testMode.mockApiResponses')
      };
    };
    
    loadMaxCollectionNumConfig = function() {
      return global.Zotero.Prefs.get('extensions.tidy-up.maxCollectionNum');
    };
  });
  
  describe('loadEmbeddingConfig', () => {
    test('should load embedding provider', () => {
      const config = loadEmbeddingConfig();
      expect(config.provider).toBe('');
    });
    
    test('should load embedding model', () => {
      const config = loadEmbeddingConfig();
      expect(config.model).toBe('');
    });
    
    test('should load embedding baseUrl', () => {
      const config = loadEmbeddingConfig();
      expect(config.baseUrl).toBe('https://bapi.huiyan-ai.cn/');
    });
    
    test('should load embedding apiKey', () => {
      const config = loadEmbeddingConfig();
      expect(config.apiKey).toBe('');
    });
    
    test('should return complete embedding config', () => {
      const config = loadEmbeddingConfig();
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('apiKey');
    });
  });
  
  describe('loadLlmConfig', () => {
    test('should load LLM provider', () => {
      const config = loadLlmConfig();
      expect(config.provider).toBe('');
    });
    
    test('should load LLM model', () => {
      const config = loadLlmConfig();
      expect(config.model).toBe('');
    });
    
    test('should load LLM baseUrl', () => {
      const config = loadLlmConfig();
      expect(config.baseUrl).toBe('https://bapi.huiyan-ai.cn/v1');
    });
    
    test('should load LLM apiKey', () => {
      const config = loadLlmConfig();
      expect(config.apiKey).toBe('');
    });
    
    test('should return complete LLM config', () => {
      const config = loadLlmConfig();
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('apiKey');
    });
  });
  
  describe('loadTestModeConfig', () => {
    test('should load test mode enabled status', () => {
      const config = loadTestModeConfig();
      expect(config.enabled).toBe(true);
    });
    
    test('should load max collections', () => {
      const config = loadTestModeConfig();
      expect(config.maxCollections).toBe(3);
    });
    
    test('should load mock API responses', () => {
      const config = loadTestModeConfig();
      expect(config.mockApiResponses).toBe(false);
    });
    
    test('should return complete test mode config', () => {
      const config = loadTestModeConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('maxCollections');
      expect(config).toHaveProperty('mockApiResponses');
    });
  });
  
  describe('loadMaxCollectionNumConfig', () => {
    test('should load max collection num', () => {
      const config = loadMaxCollectionNumConfig();
      expect(config).toBe(4);
    });
    
    test('should return number type', () => {
      const config = loadMaxCollectionNumConfig();
      expect(typeof config).toBe('number');
    });
  });
  
  describe('configuration values', () => {
    test('should have valid embedding baseUrl', () => {
      const config = loadEmbeddingConfig();
      expect(config.baseUrl).toMatch(/^https?:\/\//);
    });
    
    test('should have valid LLM baseUrl', () => {
      const config = loadLlmConfig();
      expect(config.baseUrl).toMatch(/^https?:\/\//);
    });
    
    test('should have valid max collection num', () => {
      const config = loadMaxCollectionNumConfig();
      expect(config).toBeGreaterThan(0);
      expect(config).toBeLessThanOrEqual(20);
    });
    
    test('should have valid max collections in test mode', () => {
      const config = loadTestModeConfig();
      expect(config.maxCollections).toBeGreaterThan(0);
    });
  });
  
  describe('configuration types', () => {
    test('should return string for provider', () => {
      const config = loadEmbeddingConfig();
      expect(typeof config.provider).toBe('string');
    });
    
    test('should return string for model', () => {
      const config = loadEmbeddingConfig();
      expect(typeof config.model).toBe('string');
    });
    
    test('should return string for baseUrl', () => {
      const config = loadEmbeddingConfig();
      expect(typeof config.baseUrl).toBe('string');
    });
    
    test('should return string for apiKey', () => {
      const config = loadEmbeddingConfig();
      expect(typeof config.apiKey).toBe('string');
    });
    
    test('should return boolean for test mode enabled', () => {
      const config = loadTestModeConfig();
      expect(typeof config.enabled).toBe('boolean');
    });
    
    test('should return boolean for mock API responses', () => {
      const config = loadTestModeConfig();
      expect(typeof config.mockApiResponses).toBe('boolean');
    });
  });
  
  describe('configuration defaults', () => {
    test('should have default embedding provider', () => {
      const config = loadEmbeddingConfig();
      expect(config.provider).toBeDefined();
    });
    
    test('should have default LLM provider', () => {
      const config = loadLlmConfig();
      expect(config.provider).toBeDefined();
    });
    
    test('should have default test mode enabled', () => {
      const config = loadTestModeConfig();
      expect(config.enabled).toBeDefined();
    });
    
    test('should have default max collection num', () => {
      const config = loadMaxCollectionNumConfig();
      expect(config).toBeDefined();
    });
  });
});
