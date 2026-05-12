describe('Collection Tree Integration', () => {
  let collectionTree;
  let mockCollections;
  
  beforeEach(() => {
    mockCollections = [
      { id: 1, name: 'AI', parent: null },
      { id: 2, name: '机器学习', parent: 1 },
      { id: 3, name: '深度学习', parent: 2 },
      { id: 4, name: '自然语言处理', parent: 1 },
      { id: 5, name: '计算机视觉', parent: null }
    ];
    
    collectionTree = {
      collections: [],
      
      async getAllCollections() {
        return mockCollections;
      },
      
      async getAllCollectionsTree() {
        const collections = await this.getAllCollections();
        const trees = [];
        const processed = new Set();
        
        for (const collection of collections) {
          if (!collection.parent) {
            const tree = await this.buildCollectionTree(collection, null);
            if (tree) {
              trees.push(tree);
            }
          }
        }
        
        return trees;
      },
      
      async buildCollectionTree(collection, parentId = null) {
        if (!collection) {
          return null;
        }
        
        const node = {
          id: collection.id,
          name: collection.name,
          parentId,
          confidence: 0,
          children: []
        };
        
        const children = mockCollections.filter(c => c.parent === collection.id);
        
        for (const child of children) {
          const childNode = await this.buildCollectionTree(child, collection.id);
          if (childNode) {
            node.children.push(childNode);
          }
        }
        
        return node;
      },
      
      getAllCollectionIdsFromTree(trees) {
        const ids = [];
        
        const traverse = (node) => {
          if (!node) return;
          ids.push(node.id);
          if (node.children) {
            node.children.forEach(traverse);
          }
        };
        
        trees.forEach(traverse);
        return ids;
      },
      
      async calculateTreeSimilarity(trees, itemName, blacklist = new Set()) {
        if (!trees || trees.length === 0) {
          return trees;
        }
        
        for (const tree of trees) {
          await this.calculateNodeSimilarity(tree, itemName, blacklist);
        }
        
        return trees;
      },
      
      async calculateNodeSimilarity(node, itemName, blacklist) {
        if (!node) {
          return;
        }
        
        if (blacklist.has(node.id)) {
          node.confidence = 0;
        } else {
          node.confidence = this.calculateSimilarity(node.name, itemName);
        }
        
        if (node.children) {
          for (const child of node.children) {
            await this.calculateNodeSimilarity(child, itemName, blacklist);
          }
        }
      },
      
      calculateSimilarity(text1, text2) {
        if (!text1 || !text2) {
          return 0;
        }
        
        const words1 = text1.toLowerCase().split(/\s+/).filter(Boolean);
        const words2 = text2.toLowerCase().split(/\s+/).filter(Boolean);
        
        // 若无空格则按字符分（支持中文）
        const tokens1 = words1.length > 1 ? words1 : (text1.toLowerCase().split('').filter(c => c.trim()));
        const tokens2 = words2.length > 1 ? words2 : (text2.toLowerCase().split('').filter(c => c.trim()));
        
        const common = tokens1.filter(t => tokens2.includes(t));
        const total = new Set([...tokens1, ...tokens2]).size;
        
        return total > 0 ? common.length / total : 0;
      },
      
      sortTreeBySimilarity(trees) {
        if (!trees || trees.length === 0) {
          return trees;
        }
        
        const sortNode = (node) => {
          if (!node.children || node.children.length === 0) {
            return;
          }
          
          node.children.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
          
          node.children.forEach(sortNode);
        };
        
        trees.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        trees.forEach(sortNode);
        
        return trees;
      },
      
      flattenTree(trees) {
        const flattened = [];
        
        const traverse = (node) => {
          if (!node) return;
          flattened.push(node);
          if (node.children) {
            node.children.forEach(traverse);
          }
        };
        
        trees.forEach(traverse);
        return flattened;
      }
    };
  });
  
  describe('Collection树构建流程', () => {
    test('应该完整执行Collection树构建', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      
      // Assert
      expect(tree.length).toBe(2); // 两个根节点
      expect(tree[0].id).toBe(1);
      expect(tree[0].children.length).toBe(2);
      expect(tree[0].children[0].id).toBe(2);
      expect(tree[0].children[0].children.length).toBe(1);
      expect(tree[0].children[0].children[0].id).toBe(3);
    });
    
    test('应该正确维护父子关系', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      
      // Assert
      expect(tree[0].children[0].parentId).toBe(1);
      expect(tree[0].children[0].children[0].parentId).toBe(2);
    });
    
    test('应该处理空Collection列表', async () => {
      // Arrange
      mockCollections = [];
      
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      
      // Assert
      expect(tree).toEqual([]);
    });
  });
  
  describe('树相似度计算', () => {
    test('应该正确计算树相似度', async () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: '机器学习',
          confidence: 0,
          children: []
        },
        {
          id: 2,
          name: '深度学习',
          confidence: 0,
          children: []
        }
      ];
      
      // Act
      await collectionTree.calculateTreeSimilarity(trees, '机器学习论文', new Set());
      
      // Assert
      expect(trees[0].confidence).toBeGreaterThan(trees[1].confidence);
    });
    
    test('应该应用黑名单', async () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: '机器学习',
          confidence: 0,
          children: []
        }
      ];
      const blacklist = new Set([1]);
      
      // Act
      await collectionTree.calculateTreeSimilarity(trees, '机器学习论文', blacklist);
      
      // Assert
      expect(trees[0].confidence).toBe(0);
    });
  });
  
  describe('树排序', () => {
    test('应该按相似度排序树', () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: '机器学习',
          confidence: 0.6,
          children: [
            {
              id: 2,
              name: '深度学习',
              confidence: 0.8,
              children: []
            },
            {
              id: 3,
              name: '自然语言处理',
              confidence: 0.7,
              children: []
            }
          ]
        }
      ];
      
      // Act
      const sorted = collectionTree.sortTreeBySimilarity(trees);
      
      // Assert
      expect(sorted[0].children[0].confidence).toBeGreaterThan(sorted[0].children[1].confidence);
    });
  });
  
  describe('树遍历', () => {
    test('应该正确获取所有Collection ID', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      const ids = collectionTree.getAllCollectionIdsFromTree(tree);
      
      // Assert
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
      expect(ids).toContain(4);
      expect(ids).toContain(5);
    });
    
    test('应该正确展平树', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      const flattened = collectionTree.flattenTree(tree);
      
      // Assert
      expect(flattened.length).toBe(5);
      expect(flattened.every(node => node.id)).toBe(true);
    });
  });
  
  describe('相似度计算', () => {
    test('应该正确计算相似度', () => {
      // Act
      const similarity = collectionTree.calculateSimilarity('机器学习', '机器学习论文');
      
      // Assert
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
    
    test('应该计算不同文本的相似度', () => {
      // Act
      const similarity = collectionTree.calculateSimilarity('机器学习', '深度学习');
      
      // Assert
      expect(similarity).toBeGreaterThan(0); // "学习"是共同词
      expect(similarity).toBeLessThan(0.5);
    });
    
    test('应该处理空文本', () => {
      // Act
      const similarity = collectionTree.calculateSimilarity('', '机器学习');
      
      // Assert
      expect(similarity).toBe(0);
    });
    
    test('应该处理null文本', () => {
      // Act
      const similarity = collectionTree.calculateSimilarity(null, '机器学习');
      
      // Assert
      expect(similarity).toBe(0);
    });
  });
  
  describe('树节点构建', () => {
    test('应该正确构建树节点', async () => {
      // Arrange: 使用 id 5（无子节点）验证单节点构建
      const collection = { id: 5, name: '计算机视觉', parent: null };
      
      // Act
      const node = await collectionTree.buildCollectionTree(collection, null);
      
      // Assert
      expect(node.id).toBe(5);
      expect(node.name).toBe('计算机视觉');
      expect(node.parentId).toBeNull();
      expect(node.children).toEqual([]);
    });
    
    test('应该构建带子节点的树', async () => {
      // Arrange
      const collection = { id: 1, name: 'AI', parent: null };
      
      // Act
      const node = await collectionTree.buildCollectionTree(collection, null);
      
      // Assert
      expect(node.children.length).toBeGreaterThan(0);
      expect(node.children[0].parentId).toBe(1);
    });
  });
  
  describe('树边界条件', () => {
    test('应该处理null输入', async () => {
      // Act
      const node = await collectionTree.buildCollectionTree(null, null);
      
      // Assert
      expect(node).toBeNull();
    });
    
    test('应该处理没有子节点的树', async () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: 'AI',
          confidence: 0.8,
          children: []
        }
      ];
      
      // Act
      const sorted = collectionTree.sortTreeBySimilarity(trees);
      
      // Assert
      expect(sorted.length).toBe(1);
      expect(sorted[0].children.length).toBe(0);
    });
    
    test('应该处理空树列表', () => {
      // Act
      const sorted = collectionTree.sortTreeBySimilarity([]);
      
      // Assert
      expect(sorted).toEqual([]);
    });
  });
  
  describe('树结构验证', () => {
    test('应该保持树的层次结构', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      
      // Assert
      const root = tree[0];
      expect(root.parentId).toBeNull();
      expect(root.children.length).toBeGreaterThan(0);
      expect(root.children[0].parentId).toBe(root.id);
    });
    
    test('应该正确设置节点属性', async () => {
      // Act
      const tree = await collectionTree.getAllCollectionsTree();
      
      // Assert
      const node = tree[0];
      expect(node.id).toBeDefined();
      expect(node.name).toBeDefined();
      expect(node.confidence).toBeDefined();
      expect(node.children).toBeDefined();
    });
  });
});
