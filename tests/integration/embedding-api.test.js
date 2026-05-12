describe('Embedding API Integration', () => {
  let embeddingApi;
  let mockFetch;
  
  beforeEach(() => {
    mockFetch = jest.fn((url, options) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        }),
        text: async () => 'OK'
      });
    });
    global.fetch = mockFetch;
    
    embeddingApi = {
      config: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        timeout: 30000,
        maxRetries: 3
      },
      
      cache: new Map(),
      
      setConfig(config) {
        this.config = { ...this.config, ...config };
      },
      
      async getEmbedding(text) {
        if (!text || text.trim() === '') {
          throw new Error('Text cannot be empty');
        }
        
        const cacheKey = text.toLowerCase().trim();
        
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey);
        }
        
        const embedding = await this.callEmbeddingApi(text);
        this.cache.set(cacheKey, embedding);
        
        return embedding;
      },
      
      async callEmbeddingApi(text) {
        const url = `${this.config.baseUrl}/embeddings`;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        };
        const body = JSON.stringify({
          model: this.config.model,
          input: text
        });
        
        let lastError;
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: headers,
              body: body
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.data && data.data[0] && data.data[0].embedding) {
              return data.data[0].embedding;
            }
            
            throw new Error('Invalid API response format');
          } catch (error) {
            lastError = error;
            if (attempt < this.config.maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }
        }
        
        throw lastError;
      },
      
      async getBatchEmbeddings(texts) {
        if (!texts || texts.length === 0) {
          return [];
        }
        
        const embeddings = [];
        const uncachedTexts = [];
        const uncachedIndices = [];
        
        for (let i = 0; i < texts.length; i++) {
          const cacheKey = texts[i].toLowerCase().trim();
          if (this.cache.has(cacheKey)) {
            embeddings[i] = this.cache.get(cacheKey);
          } else {
            uncachedTexts.push(texts[i]);
            uncachedIndices.push(i);
          }
        }
        
        if (uncachedTexts.length > 0) {
          const batchEmbeddings = await this.callBatchEmbeddingApi(uncachedTexts);
          
          for (let i = 0; i < uncachedIndices.length; i++) {
            const index = uncachedIndices[i];
            const embedding = batchEmbeddings[i];
            embeddings[index] = embedding;
            this.cache.set(uncachedTexts[i].toLowerCase().trim(), embedding);
          }
        }
        
        return embeddings;
      },
      
      async callBatchEmbeddingApi(texts) {
        const url = `${this.config.baseUrl}/embeddings`;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        };
        const body = JSON.stringify({
          model: this.config.model,
          input: texts
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: body
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          return data.data.map(item => item.embedding);
        }
        
        throw new Error('Invalid API response format');
      },
      
      clearCache() {
        this.cache.clear();
      },
      
      getCacheSize() {
        return this.cache.size;
      }
    };
  });
  
  describe('Embedding获取流程', () => {
    test('应该完整执行Embedding获取流程', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      // Act
      const embedding = await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    test('应该使用正确的API端点', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      // Act
      await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });
    
    test('应该发送正确的请求体', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      // Act
      await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.input).toBe('测试文本');
    });
  });
  
  describe('Embedding缓存集成', () => {
    test('应该正确使用Embedding缓存', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      embeddingApi.cache.set('测试文本', [0.5, 0.6, 0.7, 0.8]);
      
      // Act
      const embedding = await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      expect(embedding).toEqual([0.5, 0.6, 0.7, 0.8]);
      expect(mockFetch).not.toHaveBeenCalled(); // 不应该调用API
    });
    
    test('应该缓存API响应', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      // Act
      await embeddingApi.getEmbedding('测试文本');
      const cached = embeddingApi.cache.get('测试文本');
      
      // Assert
      expect(cached).toEqual([0.1, 0.2, 0.3, 0.4]);
    });
    
    test('应该使用不区分大小写的缓存键', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3, 0.4] }
          ]
        })
      });
      
      embeddingApi.cache.set('测试文本', [0.5, 0.6, 0.7, 0.8]);
      
      // Act
      const embedding1 = await embeddingApi.getEmbedding('测试文本');
      const embedding2 = await embeddingApi.getEmbedding('测试文本');
      const embedding3 = await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      expect(embedding1).toEqual([0.5, 0.6, 0.7, 0.8]);
      expect(embedding2).toEqual([0.5, 0.6, 0.7, 0.8]);
      expect(embedding3).toEqual([0.5, 0.6, 0.7, 0.8]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
  
  describe('批量Embedding获取', () => {
    test('应该获取批量Embedding', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] }
          ]
        })
      });
      
      // Act
      const embeddings = await embeddingApi.getBatchEmbeddings(['文本1', '文本2']);
      
      // Assert
      expect(embeddings.length).toBe(2);
      expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      expect(embeddings[1]).toEqual([0.4, 0.5, 0.6]);
    });
    
    test('应该使用缓存获取批量Embedding', async () => {
      // Arrange
      embeddingApi.cache.set('文本1', [0.1, 0.2, 0.3]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.4, 0.5, 0.6] }
          ]
        })
      });
      
      // Act
      const embeddings = await embeddingApi.getBatchEmbeddings(['文本1', '文本2']);
      
      // Assert
      expect(embeddings.length).toBe(2);
      expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]); // 来自缓存
      expect(embeddings[1]).toEqual([0.4, 0.5, 0.6]); // 来自API
    });
  });
  
  describe('Embedding错误处理', () => {
    test('应该处理API错误', async () => {
      // Arrange: 清缓存并 mock 错误（重试 3 次，每次返回同一错误）
      embeddingApi.cache.clear();
      const errRes = { ok: false, status: 500, text: async () => 'Internal Server Error' };
      mockFetch.mockResolvedValue(errRes);
      
      // Act & Assert
      await expect(embeddingApi.getEmbedding('error-test-unique-text')).rejects.toThrow('API error: 500 - Internal Server Error');
    });
    
    test('应该处理空文本', async () => {
      // Act & Assert
      await expect(embeddingApi.getEmbedding('')).rejects.toThrow('Text cannot be empty');
    });
    
    test('应该处理无效API响应', async () => {
      // Arrange: 清缓存并 mock 无效响应（重试 3 次）
      embeddingApi.cache.clear();
      const invalidRes = { ok: true, status: 200, json: async () => ({ invalid: 'response' }), text: async () => 'OK' };
      mockFetch.mockResolvedValue(invalidRes);
      
      // Act & Assert
      await expect(embeddingApi.getEmbedding('invalid-response-unique-text')).rejects.toThrow('Invalid API response format');
    });
  });
  
  describe('Embedding重试机制', () => {
    test('应该在失败时重试', async () => {
      // Arrange
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { embedding: [0.1, 0.2, 0.3, 0.4] }
            ]
          })
        });
      
      // Act
      const embedding = await embeddingApi.getEmbedding('测试文本');
      
      // Assert
      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
    
    test('应该在达到最大重试次数后失败', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      // Act & Assert
      await expect(embeddingApi.getEmbedding('测试文本')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // 初始调用 + 2次重试
    });
  });
  
  describe('Embedding配置', () => {
    test('应该正确设置配置', () => {
      // Act
      embeddingApi.setConfig({
        provider: 'cohere',
        model: 'embed-english-v3.0',
        apiKey: 'new-key'
      });
      
      // Assert
      expect(embeddingApi.config.provider).toBe('cohere');
      expect(embeddingApi.config.model).toBe('embed-english-v3.0');
      expect(embeddingApi.config.apiKey).toBe('new-key');
    });
    
    test('应该使用默认配置', () => {
      // Act
      const config = embeddingApi.config;
      
      // Assert
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('text-embedding-3-small');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.apiKey).toBe('test-key');
    });
  });
  
  describe('Embedding缓存管理', () => {
    test('应该正确清空缓存', async () => {
      // Arrange
      embeddingApi.cache.set('文本1', [0.1, 0.2, 0.3]);
      embeddingApi.cache.set('文本2', [0.4, 0.5, 0.6]);
      
      // Act
      embeddingApi.clearCache();
      
      // Assert
      expect(embeddingApi.getCacheSize()).toBe(0);
    });
    
    test('应该正确获取缓存大小', () => {
      // Arrange
      embeddingApi.cache.set('文本1', [0.1, 0.2, 0.3]);
      embeddingApi.cache.set('文本2', [0.4, 0.5, 0.6]);
      
      // Act
      const size = embeddingApi.getCacheSize();
      
      // Assert
      expect(size).toBe(2);
    });
  });
  
  describe('Embedding边界条件', () => {
    test('应该处理null文本', async () => {
      // Act & Assert
      await expect(embeddingApi.getEmbedding(null)).rejects.toThrow('Text cannot be empty');
    });
    
    test('应该处理undefined文本', async () => {
      // Act & Assert
      await expect(embeddingApi.getEmbedding(undefined)).rejects.toThrow('Text cannot be empty');
    });
    
    test('应该处理空批量列表', async () => {
      // Act
      const embeddings = await embeddingApi.getBatchEmbeddings([]);
      
      // Assert
      expect(embeddings).toEqual([]);
    });
  });
});
