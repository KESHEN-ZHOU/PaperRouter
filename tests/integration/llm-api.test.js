describe('LLM API Integration', () => {
  let llmApi;
  let mockFetch;
  
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    llmApi = {
      config: {
        provider: 'openai',
        model: 'gpt-4.1',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        timeout: 30000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: 1000
      },
      
      setConfig(config) {
        this.config = { ...this.config, ...config };
      },
      
      async callLlmApi(prompt, algorithm = 'unknown') {
        if (!prompt || prompt.trim() === '') {
          throw new Error('Prompt cannot be empty');
        }
        
        const url = `${this.config.baseUrl}/chat/completions`;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        };
        const body = JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
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
            
            if (data.choices && data.choices[0] && data.choices[0].message) {
              return data.choices[0].message.content;
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
      
      async classifyCollectionType(collectionName, collectionDescription) {
        const prompt = `请分析以下Collection的类型，判断它是"外在描述型"还是"内在含义型"：

Collection名称：${collectionName}
Collection描述：${collectionDescription}

外在描述型：以会议、期刊、作者等外部特征命名，如"AAAI"、"ACL"、"Yann LeCun"
内在含义型：以研究领域、主题等内部特征命名，如"机器学习"、"深度学习"、"自然语言处理"

请只返回"外在描述型"或"内在含义型"中的一个。`;

        const response = await this.callLlmApi(prompt, 'llm');
        return response.trim();
      },
      
      async classifyItemWithZeroShot(itemName, itemAbstract, collections, maxCollections = 3) {
        if (!collections || collections.length === 0) {
          return [];
        }
        
        const collectionNames = collections.map(c => c.name).join('、');
        const prompt = `请分析以下论文应该归入哪些Collection：

论文标题：${itemName}
论文摘要：${itemAbstract}

可选Collection：${collectionNames}

请为每个Collection打分（0-1），表示论文与该Collection的匹配程度。
返回格式：Collection名称: 分数，用逗号分隔。`;

        const response = await this.callLlmApi(prompt, 'zeroshot');
        return this.parseClassificationResponse(response, collections, maxCollections);
      },
      
      parseClassificationResponse(response, collections, maxCollections) {
        const results = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
          const parts = line.split(',');
          for (const part of parts) {
            const match = part.match(/^\s*(.+?):\s*([\d.]+)\s*$/);
            if (match) {
              const name = match[1].trim();
              const score = parseFloat(match[2]);
              const collection = collections.find(c => c.name === name);
              if (collection && !isNaN(score)) {
                results.push({
                  collection: collection,
                  name: name,
                  score: score
                });
              }
            }
          }
        }
        
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, maxCollections);
      },
      
      async generateCollectionSuggestion(itemName, itemAbstract) {
        const prompt = `请根据以下论文信息，建议3个合适的Collection名称：

论文标题：${itemName}
论文摘要：${itemAbstract}

请只返回Collection名称，每行一个。`;

        const response = await this.callLlmApi(prompt, 'suggestion');
        return response.split('\n').filter(line => line.trim()).slice(0, 3);
      }
    };
  });
  
  describe('LLM调用流程', () => {
    test('应该完整执行LLM调用流程', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '外在描述型'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      // Act
      const response = await llmApi.callLlmApi('测试提示词', 'test');
      
      // Assert
      expect(response).toBe('外在描述型');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    test('应该使用正确的API端点', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '测试响应'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      // Act
      await llmApi.callLlmApi('测试提示词', 'test');
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
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
          choices: [{
            message: {
              content: '测试响应'
            }
          }]
        })
      });
      
      // Act
      await llmApi.callLlmApi('测试提示词', 'test');
      
      // Assert
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4.1');
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('测试提示词');
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(1000);
    });
  });
  
  describe('Collection类型分类', () => {
    test('应该正确分类外在描述型Collection', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '外在描述型'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      // Act
      const type = await llmApi.classifyCollectionType('AAAI', 'AAAI会议论文');
      
      // Assert
      expect(type).toBe('外在描述型');
    });
    
    test('应该正确分类内在含义型Collection', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '内在含义型'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      // Act
      const type = await llmApi.classifyCollectionType('机器学习', '机器学习相关论文');
      
      // Assert
      expect(type).toBe('内在含义型');
    });
  });
  
  describe('零样本分类', () => {
    test('应该完整执行零样本分类', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '机器学习: 0.9, 深度学习: 0.8, 自然语言处理: 0.7'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      const collections = [
        { id: 1, name: '机器学习' },
        { id: 2, name: '深度学习' },
        { id: 3, name: '自然语言处理' }
      ];
      
      // Act
      const result = await llmApi.classifyItemWithZeroShot(
        '测试论文',
        '测试摘要',
        collections,
        2
      );
      
      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('机器学习');
      expect(result[0].score).toBe(0.9);
    });
    
    test('应该按分数排序结果', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '深度学习: 0.8, 机器学习: 0.9, 自然语言处理: 0.7'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      const collections = [
        { id: 1, name: '机器学习' },
        { id: 2, name: '深度学习' },
        { id: 3, name: '自然语言处理' }
      ];
      
      // Act
      const result = await llmApi.classifyItemWithZeroShot(
        '测试论文',
        '测试摘要',
        collections,
        3
      );
      
      // Assert
      expect(result[0].score).toBeGreaterThan(result[1].score);
      expect(result[1].score).toBeGreaterThan(result[2].score);
    });
  });
  
  describe('Collection建议生成', () => {
    test('应该生成Collection建议', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: '机器学习\n深度学习\n自然语言处理'
            }
          }]
        }),
        text: async () => 'OK'
      });
      
      // Act
      const suggestions = await llmApi.generateCollectionSuggestion(
        '测试论文',
        '测试摘要'
      );
      
      // Assert
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('机器学习');
      expect(suggestions[1]).toBe('深度学习');
      expect(suggestions[2]).toBe('自然语言处理');
    });
  });
  
  describe('LLM错误处理', () => {
    test('应该处理API错误', async () => {
      // Arrange: 重试 3 次，每次 fetch 都需返回相同错误
      const errorResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      };
      mockFetch.mockResolvedValue(errorResponse);
      
      // Act & Assert
      await expect(llmApi.callLlmApi('测试提示词', 'test')).rejects.toThrow('API error: 500 - Internal Server Error');
    });
    
    test('应该处理空提示词', async () => {
      // Act & Assert
      await expect(llmApi.callLlmApi('', 'test')).rejects.toThrow('Prompt cannot be empty');
    });
    
    test('应该处理无效API响应', async () => {
      // Arrange: 重试 3 次，每次都返回无效结构
      const invalidResponse = {
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
        text: async () => 'OK'
      };
      mockFetch.mockResolvedValue(invalidResponse);
      
      // Act & Assert
      await expect(llmApi.callLlmApi('测试提示词', 'test')).rejects.toThrow('Invalid API response format');
    });
  });
  
  describe('LLM重试机制', () => {
    test('应该在失败时重试', async () => {
      // Arrange
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                content: '测试响应'
              }
            }]
          }),
          text: async () => 'OK'
        });
      
      // Act
      const response = await llmApi.callLlmApi('测试提示词', 'test');
      
      // Assert
      expect(response).toBe('测试响应');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
    
    test('应该在达到最大重试次数后失败', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      // Act & Assert
      await expect(llmApi.callLlmApi('测试提示词', 'test')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // 初始调用 + 2次重试
    });
  });
  
  describe('LLM配置', () => {
    test('应该正确设置配置', () => {
      // Act
      llmApi.setConfig({
        provider: 'cohere',
        model: 'command-r',
        apiKey: 'new-key',
        temperature: 0.5,
        maxTokens: 2000
      });
      
      // Assert
      expect(llmApi.config.provider).toBe('cohere');
      expect(llmApi.config.model).toBe('command-r');
      expect(llmApi.config.apiKey).toBe('new-key');
      expect(llmApi.config.temperature).toBe(0.5);
      expect(llmApi.config.maxTokens).toBe(2000);
    });
    
    test('应该使用默认配置', () => {
      // Act
      const config = llmApi.config;
      
      // Assert
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4.1');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.apiKey).toBe('test-key');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
    });
  });
  
  describe('LLM边界条件', () => {
    test('应该处理null提示词', async () => {
      // Act & Assert
      await expect(llmApi.callLlmApi(null, 'test')).rejects.toThrow('Prompt cannot be empty');
    });
    
    test('应该处理undefined提示词', async () => {
      // Act & Assert
      await expect(llmApi.callLlmApi(undefined, 'test')).rejects.toThrow('Prompt cannot be empty');
    });
    
    test('应该处理空Collection列表', async () => {
      // Act
      const result = await llmApi.classifyItemWithZeroShot(
        '测试论文',
        '测试摘要',
        [],
        3
      );
      
      // Assert
      expect(result).toEqual([]);
    });
  });
  
  describe('分类响应解析', () => {
    test('应该正确解析分类响应', () => {
      // Arrange
      const response = '机器学习: 0.9, 深度学习: 0.8, 自然语言处理: 0.7';
      const collections = [
        { id: 1, name: '机器学习' },
        { id: 2, name: '深度学习' },
        { id: 3, name: '自然语言处理' }
      ];
      
      // Act
      const result = llmApi.parseClassificationResponse(response, collections, 3);
      
      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('机器学习');
      expect(result[0].score).toBe(0.9);
    });
    
    test('应该过滤无效的Collection', () => {
      // Arrange
      const response = '机器学习: 0.9, 不存在的Collection: 0.8, 深度学习: 0.7';
      const collections = [
        { id: 1, name: '机器学习' },
        { id: 2, name: '深度学习' }
      ];
      
      // Act
      const result = llmApi.parseClassificationResponse(response, collections, 3);
      
      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('机器学习');
      expect(result[1].name).toBe('深度学习');
    });
  });
});
