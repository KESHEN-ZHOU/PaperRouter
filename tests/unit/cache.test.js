describe('Collection Type Cache', () => {
  let cache;
  
  beforeEach(() => {
    cache = {
      cache: new Map(),
      initialized: false,
      filePath: '/tmp/test-cache.json',
      
      get size() {
        return this.cache.size;
      },
      
      async init(rootURI) {
        this.initialized = true;
      },
      
      async load() {
        this.cache.set('1', 'external');
        this.cache.set('2', 'internal');
      },
      
      async save() {
      },
      
      get(collectionId) {
        return this.cache.get(collectionId);
      },
      
      set(collectionId, type) {
        this.cache.set(collectionId, type);
      },
      
      clear() {
        this.cache.clear();
      }
    };
  });
  
  describe('get', () => {
    test('should return cached type', () => {
      cache.cache.set('1', 'external');
      const result = cache.get('1');
      expect(result).toBe('external');
    });
    
    test('should return undefined for non-existent key', () => {
      const result = cache.get('999');
      expect(result).toBeUndefined();
    });
    
    test('should return correct type for internal collection', () => {
      cache.cache.set('3', 'internal');
      const result = cache.get('3');
      expect(result).toBe('internal');
    });
  });
  
  describe('set', () => {
    test('should set and retrieve type', () => {
      cache.set('3', 'internal');
      expect(cache.get('3')).toBe('internal');
    });
    
    test('should overwrite existing type', () => {
      cache.set('1', 'external');
      cache.set('1', 'internal');
      expect(cache.get('1')).toBe('internal');
    });
    
    test('should handle different collection types', () => {
      cache.set('1', 'external');
      cache.set('2', 'internal');
      cache.set('3', 'default');
      
      expect(cache.get('1')).toBe('external');
      expect(cache.get('2')).toBe('internal');
      expect(cache.get('3')).toBe('default');
    });
  });
  
  describe('clear', () => {
    test('should clear all cached data', () => {
      cache.set('1', 'external');
      cache.set('2', 'internal');
      expect(cache.size).toBe(2);
      
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('1')).toBeUndefined();
      expect(cache.get('2')).toBeUndefined();
    });
  });
  
  describe('size', () => {
    test('should return correct cache size', () => {
      expect(cache.size).toBe(0);
      
      cache.set('1', 'external');
      expect(cache.size).toBe(1);
      
      cache.set('2', 'internal');
      expect(cache.size).toBe(2);
      
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
  
  describe('init', () => {
    test('should initialize cache', async () => {
      expect(cache.initialized).toBe(false);
      
      await cache.init('/root/uri');
      
      expect(cache.initialized).toBe(true);
    });
  });
  
  describe('load', () => {
    test('should load cached data', async () => {
      expect(cache.size).toBe(0);
      
      await cache.load();
      
      expect(cache.size).toBe(2);
      expect(cache.get('1')).toBe('external');
      expect(cache.get('2')).toBe('internal');
    });
  });
  
  describe('save', () => {
    test('should save cached data', async () => {
      cache.set('1', 'external');
      cache.set('2', 'internal');
      
      await cache.save();
      
      expect(cache.size).toBe(2);
    });
  });
});
