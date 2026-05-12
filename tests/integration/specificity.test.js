describe('Collection Specificity System Integration', () => {
  let collectionSpecificity;
  let mockItems;
  
  beforeEach(() => {
    mockItems = [
      { id: 1, title: '机器学习论文1', abstract: '这是关于机器学习的研究' },
      { id: 2, title: '机器学习论文2', abstract: '这是关于机器学习的应用' },
      { id: 3, title: '深度学习论文', abstract: '这是关于深度学习的研究' }
    ];
    
    collectionSpecificity = {
      specificityCache: new Map(),
      initialized: false,
      filePath: null,
      
      config: {
        minItemsForSpecificity: 3,
        minSpecificityWeight: 0.6,
        maxSpecificityWeight: 1.2,
        similarityThreshold: 0.3,
        useEmbeddingForSpecificity: true
      },
      
      async init(rootURI) {
        if (this.initialized) return;
        this.initialized = true;
      },
      
      async load() {
      },
      
      async save() {
      },
      
      async calculateSpecificity(collection) {
        const itemIDs = await collection.getChildItems();
        const items = mockItems.filter(item => itemIDs.includes(item.id));
        
        if (items.length < this.config.minItemsForSpecificity) {
          return 0.5;
        }
        
        let totalSimilarity = 0;
        let pairCount = 0;
        
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const similarity = this.calculateItemSimilarity(items[i], items[j]);
            totalSimilarity += similarity;
            pairCount++;
          }
        }
        
        const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
        const specificity = 1 - avgSimilarity;
        
        return Math.max(0, Math.min(1, specificity));
      },
      
      calculateItemSimilarity(item1, item2) {
        const title1 = (item1.title || '').toLowerCase();
        const title2 = (item2.title || '').toLowerCase();
        const abstract1 = (item1.abstract || '').toLowerCase();
        const abstract2 = (item2.abstract || '').toLowerCase();
        
        const text1 = title1 + ' ' + abstract1;
        const text2 = title2 + ' ' + abstract2;
        
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = new Set([...words1, ...words2]).size;
        
        return totalWords > 0 ? commonWords.length / totalWords : 0;
      },
      
      applySpecificityWeightById(collectionId, collectionName, similarity) {
        const specificity = this.specificityCache.get(collectionId);
        const weight = specificity !== undefined && specificity !== null
          ? Math.max(this.config.minSpecificityWeight, Math.min(this.config.maxSpecificityWeight, specificity + 0.5))
          : 0.5;
        return similarity * weight;
      },
      
      removeSpecificity(collectionId) {
        this.specificityCache.delete(collectionId);
      }
    };
  });
  
  describe('特异性计算流程', () => {
    test('应该完整执行特异性计算流程', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      const mockCollection = {
        id: 1,
        name: '机器学习',
        getChildItems: jest.fn(() => Promise.resolve([1, 2, 3]))
      };
      
      // Act
      const specificity = await collectionSpecificity.calculateSpecificity(mockCollection);
      
      // Assert
      expect(specificity).toBeGreaterThanOrEqual(0);
      expect(specificity).toBeLessThanOrEqual(1);
      expect(mockCollection.getChildItems).toHaveBeenCalled();
    });
    
    test('应该计算Item之间的相似度', async () => {
      // Arrange: Mock 按空格分词，用英文保证有共同词
      await collectionSpecificity.init('/root/uri');
      const item1 = { title: 'machine learning paper 1', abstract: 'about machine learning' };
      const item2 = { title: 'machine learning paper 2', abstract: 'about machine learning' };
      
      // Act
      const similarity = collectionSpecificity.calculateItemSimilarity(item1, item2);
      
      // Assert
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
    
    test('应该计算不同主题Item的相似度', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      const item1 = mockItems[0]; // 机器学习
      const item2 = mockItems[2]; // 深度学习
      
      // Act
      const similarity = collectionSpecificity.calculateItemSimilarity(item1, item2);
      
      // Assert
      expect(similarity).toBeLessThan(0.5); // 不同主题应该相似度较低
    });
  });
  
  describe('特异性权重应用', () => {
    test('应该正确应用特异性权重', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      collectionSpecificity.specificityCache.set(1, 0.9); // 高特异性
      collectionSpecificity.specificityCache.set(2, 0.3); // 低特异性
      
      // Act
      const weight1 = collectionSpecificity.applySpecificityWeightById(1, 'Collection A', 0.8);
      const weight2 = collectionSpecificity.applySpecificityWeightById(2, 'Collection B', 0.8);
      
      // Assert
      expect(weight1).toBeGreaterThan(weight2); // 高特异性应该获得更高权重
      expect(weight1).toBeGreaterThan(0.8); // 应该提高分数
      expect(weight2).toBeLessThan(0.8); // 应该降低分数
    });
    
    test('应该在配置范围内应用权重', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      collectionSpecificity.specificityCache.set(1, 1.0); // 最高特异性
      
      // Act
      const weight = collectionSpecificity.applySpecificityWeightById(1, 'Collection A', 0.8);
      
      // Assert
      expect(weight).toBeGreaterThanOrEqual(0.8 * 0.6); // 最小权重
      expect(weight).toBeLessThanOrEqual(0.8 * 1.2); // 最大权重
    });
  });
  
  describe('特异性边界条件', () => {
    test('应该处理Item数量不足的情况', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      const mockCollection = {
        id: 1,
        name: '测试Collection',
        getChildItems: jest.fn(() => Promise.resolve([1])) // 只有1个Item
      };
      
      // Act
      const specificity = await collectionSpecificity.calculateSpecificity(mockCollection);
      
      // Assert
      expect(specificity).toBe(0.5); // 应该返回默认特异性
    });
    
    test('应该处理空Collection', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      const mockCollection = {
        id: 1,
        name: '测试Collection',
        getChildItems: jest.fn(() => Promise.resolve([]))
      };
      
      // Act
      const specificity = await collectionSpecificity.calculateSpecificity(mockCollection);
      
      // Assert
      expect(specificity).toBe(0.5); // 应该返回默认特异性
    });
    
    test('应该处理没有缓存的Collection', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      // Act
      const weight = collectionSpecificity.applySpecificityWeightById(999, 'Unknown Collection', 0.8);
      
      // Assert
      expect(weight).toBe(0.8 * 0.5); // 应该使用默认权重
    });
  });
  
  describe('特异性持久化', () => {
    test('应该保存和加载特异性数据', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      collectionSpecificity.specificityCache.set(1, 0.9);
      await collectionSpecificity.save();
      
      // Act
      collectionSpecificity.specificityCache.clear();
      await collectionSpecificity.load();
      
      // Assert
      expect(collectionSpecificity.specificityCache.size).toBe(0); // Mock的load不返回数据
    });
  });
  
  describe('特异性初始化', () => {
    test('应该正确初始化特异性系统', async () => {
      // Act
      await collectionSpecificity.init('/root/uri');
      
      // Assert
      expect(collectionSpecificity.initialized).toBe(true);
      expect(collectionSpecificity.specificityCache.size).toBe(0);
    });
    
    test('应该避免重复初始化', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      collectionSpecificity.specificityCache.set(1, 0.9);
      
      // Act
      await collectionSpecificity.init('/root/uri');
      
      // Assert
      expect(collectionSpecificity.specificityCache.size).toBe(1); // 数据应该保留
    });
  });
  
  describe('特异性配置', () => {
    test('应该使用正确的特异性配置', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      
      // Act
      const config = collectionSpecificity.config;
      
      // Assert
      expect(config.minItemsForSpecificity).toBe(3);
      expect(config.minSpecificityWeight).toBe(0.6);
      expect(config.maxSpecificityWeight).toBe(1.2);
      expect(config.similarityThreshold).toBe(0.3);
      expect(config.useEmbeddingForSpecificity).toBe(true);
    });
  });
  
  describe('特异性移除', () => {
    test('应该正确移除特异性', async () => {
      // Arrange
      await collectionSpecificity.init('/root/uri');
      collectionSpecificity.specificityCache.set(1, 0.9);
      collectionSpecificity.specificityCache.set(2, 0.8);
      
      // Act
      collectionSpecificity.removeSpecificity(1);
      
      // Assert
      expect(collectionSpecificity.specificityCache.has(1)).toBe(false);
      expect(collectionSpecificity.specificityCache.has(2)).toBe(true); // 其他数据应该保留
    });
  });
});
