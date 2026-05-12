const mockZotero = {
  debug: jest.fn(),
  log: jest.fn(),
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
  },
  Collections: {
    getAsync: jest.fn((id) => {
      return Promise.resolve({
        id: id,
        name: `Collection ${id}`,
        getChildItems: jest.fn(() => Promise.resolve([]))
      });
    }),
    getAll: jest.fn(() => Promise.resolve([]))
  },
  Notifier: {
    registerObserver: jest.fn(() => 'notifier-id'),
    unregisterObserver: jest.fn()
  },
  Items: {
    getAsync: jest.fn((id) => {
      return Promise.resolve({
        id: id,
        title: `Item ${id}`,
        abstract: 'Test abstract'
      });
    })
  }
};

const mockIOUtils = {
  writeUTF8: jest.fn(),
  readUTF8: jest.fn(() => Promise.resolve('{}')),
  exists: jest.fn(() => Promise.resolve(false))
};

const mockServices = {
  prefs: {
    getBranch: jest.fn(() => ({
      getCharPref: jest.fn(),
      setCharPref: jest.fn(),
      getBoolPref: jest.fn(),
      setBoolPref: jest.fn(),
      getIntPref: jest.fn(),
      setIntPref: jest.fn()
    }))
  }
};

const mockCc = jest.fn(() => ({
  getService: jest.fn(() => ({
    createInstance: jest.fn(() => ({
      init: jest.fn(),
      createOutputStream: jest.fn(),
      close: jest.fn()
    }))
  }))
});

const mockCi = {
  nsIFileOutputStream: {},
  nsIConverterOutputStream: {}
};

module.exports = {
  mockZotero,
  mockIOUtils,
  mockServices,
  mockCc,
  mockCi
};
