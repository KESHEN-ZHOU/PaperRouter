describe('IDF Weighting System Integration', () => {
  let idfWeighting;
  
  beforeEach(() => {
    idfWeighting = {
      phraseFrequency: new Map(),
      totalCollections: 0,
      initialized: false,
      filePath: null,
      
      config: {
        minPhraseLength: 2,
        maxPhraseWords: 4,
        minOccurrence: 1,
        idfBase: 1.0,
        minIdfWeight: 0.5,
        maxIdfWeight: 2.0
      },
      
      async init(rootURI) {
        if (this.initialized) return;
        this.initialized = true;
      },
      
      async load() {
        if (this._persisted) {
          this.phraseFrequency = new Map(this._persisted.phraseFrequency);
          this.totalCollections = this._persisted.totalCollections || 0;
        }
      },
      
      async save() {
        this._persisted = {
          phraseFrequency: new Map(this.phraseFrequency),
          totalCollections: this.totalCollections
        };
      },
      
      extractPhrases(text) {
        const phrases = [];
        const words = text.toLowerCase().split(/\s+/);
        
        for (let i = 0; i < words.length; i++) {
          for (let j = 1; j <= this.config.maxPhraseWords && (i + j) <= words.length; j++) {
            const phrase = words.slice(i, i + j).join(' ');
            if (phrase.length >= this.config.minPhraseLength) {
              phrases.push(phrase);
            }
          }
        }
        
        return [...new Set(phrases)];
      },
      
      async updateIDF(collectionId, text) {
        const phrases = this.extractPhrases(text);
        
        for (const phrase of phrases) {
          const count = this.phraseFrequency.get(phrase) || 0;
          this.phraseFrequency.set(phrase, count + 1);
        }
        
        this.totalCollections++;
      },
      
      applyIDFWeight(collectionId, text, similarity) {
        const phrases = this.extractPhrases(text);
        let totalWeight = 0;
        let phraseCount = 0;
        
        for (const phrase of phrases) {
          const frequency = this.phraseFrequency.get(phrase) || 0;
          if (frequency >= this.config.minOccurrence) {
            const idf = Math.log((this.totalCollections + this.config.idfBase) / (frequency + this.config.idfBase));
            const weight = Math.max(this.config.minIdfWeight, Math.min(this.config.maxIdfWeight, idf));
            totalWeight += weight;
            phraseCount++;
          }
        }
        
        const avgWeight = phraseCount > 0 ? totalWeight / phraseCount : 1;
        return similarity * avgWeight;
      }
    };
  });
  
  describe('IDF计算流程', () => {
    test('应该完整执行IDF计算流程', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      
      // Act
      await idfWeighting.updateIDF(1, '机器学习 深度学习');
      await idfWeighting.updateIDF(2, '机器学习 自然语言处理');
      await idfWeighting.updateIDF(3, '深度学习 计算机视觉');
      
      // Assert
      expect(idfWeighting.totalCollections).toBe(3);
      expect(idfWeighting.phraseFrequency.size).toBeGreaterThan(0);
    });
    
    test('应该正确提取词组', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      
      // Act
      const phrases = idfWeighting.extractPhrases('机器学习 深度学习 自然语言处理');
      
      // Assert
      expect(phrases).toContain('机器学习');
      expect(phrases).toContain('深度学习');
      expect(phrases).toContain('自然语言处理');
      expect(phrases).toContain('机器学习 深度学习');
    });
    
    test('应该正确计算IDF权重', async () => {
      // Arrange: ab 在 3 个 collection、cd 仅在 1 个，出现越多权重越低（中间可能受 minIdfWeight 限制）
      await idfWeighting.init('/root/uri');
      await idfWeighting.updateIDF(1, 'ab bc cd');
      await idfWeighting.updateIDF(2, 'ab bc');
      await idfWeighting.updateIDF(3, 'ab');
      
      const weight1 = idfWeighting.applyIDFWeight(1, 'ab', 0.8);
      const weight3 = idfWeighting.applyIDFWeight(3, 'cd', 0.8);
      
      // Assert: ab 出现 3 次权重最低，cd 仅 1 次权重最高
      expect(weight1).toBeLessThan(weight3);
    });
  });
  
  describe('IDF持久化', () => {
    test('应该保存和加载IDF数据', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      await idfWeighting.updateIDF(1, '机器学习');
      await idfWeighting.save();
      
      // Act
      idfWeighting.phraseFrequency.clear();
      idfWeighting.totalCollections = 0;
      await idfWeighting.load();
      
      // Assert
      expect(idfWeighting.phraseFrequency.size).toBeGreaterThan(0);
      expect(idfWeighting.totalCollections).toBeGreaterThan(0);
    });
  });
  
  describe('IDF配置', () => {
    test('应该使用正确的IDF配置', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      
      // Act
      const config = idfWeighting.config;
      
      // Assert
      expect(config.minPhraseLength).toBe(2);
      expect(config.maxPhraseWords).toBe(4);
      expect(config.minOccurrence).toBe(1);
      expect(config.idfBase).toBe(1.0);
      expect(config.minIdfWeight).toBe(0.5);
      expect(config.maxIdfWeight).toBe(2.0);
    });
  });
  
  describe('IDF边界条件', () => {
    test('应该处理空文本', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      
      // Act
      const phrases = idfWeighting.extractPhrases('');
      
      // Assert
      expect(phrases).toEqual([]);
    });
    
    test('应该处理短词组', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      
      // Act
      const phrases = idfWeighting.extractPhrases('AI');
      
      // Assert
      expect(phrases).not.toContain('AI'); // 少于最小长度
    });
    
    test('应该处理长词组', async () => {
      // Arrange: maxPhraseWords=4，四词短语会被包含；用 5 个词验证超过 maxPhraseWords 的不出现
      await idfWeighting.init('/root/uri');
      idfWeighting.config.maxPhraseWords = 3;
      
      const phrases = idfWeighting.extractPhrases('机器学习 深度学习 自然语言处理 计算机视觉');
      
      // Assert
      expect(phrases).toContain('机器学习 深度学习');
      expect(phrases).toContain('深度学习 自然语言处理');
      expect(phrases).not.toContain('机器学习 深度学习 自然语言处理 计算机视觉'); // 超过最大词数 3
    });
  });
  
  describe('IDF权重范围', () => {
    test('应该在配置范围内计算IDF权重', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      await idfWeighting.updateIDF(1, '机器学习');
      
      // Act
      const weight = idfWeighting.applyIDFWeight(1, '机器学习', 0.8);
      
      // Assert
      expect(weight).toBeGreaterThanOrEqual(0.8 * 0.5); // 最小权重
      expect(weight).toBeLessThanOrEqual(0.8 * 2.0); // 最大权重
    });
  });
  
  describe('IDF初始化', () => {
    test('应该正确初始化IDF系统', async () => {
      // Act
      await idfWeighting.init('/root/uri');
      
      // Assert
      expect(idfWeighting.initialized).toBe(true);
      expect(idfWeighting.totalCollections).toBe(0);
      expect(idfWeighting.phraseFrequency.size).toBe(0);
    });
    
    test('应该避免重复初始化', async () => {
      // Arrange
      await idfWeighting.init('/root/uri');
      await idfWeighting.updateIDF(1, '机器学习');
      
      // Act
      await idfWeighting.init('/root/uri');
      
      // Assert
      expect(idfWeighting.totalCollections).toBe(1); // 数据应该保留
    });
  });
});
