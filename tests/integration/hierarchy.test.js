describe('Hierarchy Optimization Integration', () => {
  let hierarchyOptimization;
  
  beforeEach(() => {
    hierarchyOptimization = {
      config: {
        parentChildSimilarityThreshold: 0.7,
        minParentConfidence: 0.3,
        childInheritanceFactor: 0.5,
        maxDepth: 5
      },
      
      applyHierarchyOptimization(trees) {
        if (!trees || trees.length === 0) {
          return trees;
        }
        
        const optimized = JSON.parse(JSON.stringify(trees));
        
        for (const tree of optimized) {
          this.optimizeNode(tree);
        }
        
        return optimized;
      },
      
      optimizeNode(node) {
        if (!node.children || node.children.length === 0) {
          return node;
        }
        
        for (const child of node.children) {
          this.optimizeNode(child);
        }
        
        const maxChildConfidence = Math.max(...node.children.map(c => c.confidence || 0));
        const inheritance = maxChildConfidence * this.config.childInheritanceFactor;
        node.confidence = Math.max(node.confidence || 0, inheritance);
        
        return node;
      },
      
      filterHierarchyRelationships(trees) {
        if (!trees || trees.length === 0) {
          return trees;
        }
        
        const filtered = [];
        
        for (const tree of trees) {
          const result = this.filterNode(tree, null);
          if (result) {
            filtered.push(result);
          }
        }
        
        return filtered;
      },
      
      filterNode(node, parent) {
        if (!node) {
          return null;
        }
        
        const shouldKeepNode = this.shouldKeepNode(node, parent);
        
        if (!shouldKeepNode && parent) {
          return null;
        }
        
        if (!node.children || node.children.length === 0) {
          return shouldKeepNode ? node : null;
        }
        
        const filteredChildren = [];
        for (const child of node.children) {
          const filteredChild = this.filterNode(child, node);
          if (filteredChild) {
            filteredChildren.push(filteredChild);
          }
        }
        
        if (filteredChildren.length === 0) {
          node.children = [];
          return shouldKeepNode ? node : null;
        }
        
        node.children = filteredChildren;
        return node;
      },
      
      shouldKeepNode(node, parent) {
        if (!parent) {
          return true;
        }
        
        const similarity = this.calculateParentChildSimilarity(node, parent);
        return similarity < this.config.parentChildSimilarityThreshold;
      },
      
      calculateParentChildSimilarity(child, parent) {
        if (!child.name || !parent.name) {
          return 0;
        }
        
        const childWords = child.name.toLowerCase().split(/\s+/);
        const parentWords = parent.name.toLowerCase().split(/\s+/);
        
        const commonWords = childWords.filter(word => parentWords.includes(word));
        const totalWords = new Set([...childWords, ...parentWords]).size;
        
        return totalWords > 0 ? commonWords.length / totalWords : 0;
      },
      
      getAncestorNodes(node) {
        const ancestors = [];
        let current = node;
        
        while (current) {
          if (current.parent) {
            ancestors.push(current.parent);
          }
          current = current.parent;
        }
        
        return ancestors;
      },
      
      calculateDepth(node) {
        if (!node || !node.children || node.children.length === 0) {
          return 1;
        }
        
        const childDepths = node.children.map(child => this.calculateDepth(child));
        return 1 + Math.max(...childDepths);
      }
    };
  });
  
  describe('层次结构优化流程', () => {
    test('应该完整执行层次结构优化', () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: 'AI',
          confidence: 0.8,
          children: [
            {
              id: 2,
              name: '机器学习',
              confidence: 0.9,
              children: []
            },
            {
              id: 3,
              name: '深度学习',
              confidence: 0.7,
              children: []
            }
          ]
        }
      ];
      
      // Act
      const optimized = hierarchyOptimization.applyHierarchyOptimization(trees);
      
      // Assert
      expect(optimized.length).toBe(1);
      expect(optimized[0].confidence).toBeGreaterThanOrEqual(0.8); // 父节点继承子节点分数后不低于原值
    });
    
    test('应该正确优化多层结构', () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: 'AI',
          confidence: 0.5,
          children: [
            {
              id: 2,
              name: '机器学习',
              confidence: 0.6,
              children: [
                {
                  id: 3,
                  name: '深度学习',
                  confidence: 0.9,
                  children: []
                }
              ]
            }
          ]
        }
      ];
      
      // Act
      const optimized = hierarchyOptimization.applyHierarchyOptimization(trees);
      
      // Assert
      expect(optimized[0].confidence).toBeGreaterThanOrEqual(0.5); // 根节点继承后不低于原值
      expect(optimized[0].children[0].confidence).toBeGreaterThanOrEqual(0.6); // 中间节点继承后不低于原值
    });
    
    test('应该处理空树', () => {
      // Act
      const optimized = hierarchyOptimization.applyHierarchyOptimization([]);
      
      // Assert
      expect(optimized).toEqual([]);
    });
  });
  
  describe('父子关系过滤', () => {
    test('应该正确过滤父子关系', () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: 'AI',
          confidence: 0.8,
          children: [
            {
              id: 2,
              name: '机器学习',
              confidence: 0.9,
              children: []
            }
          ]
        }
      ];
      
      // Act
      const filtered = hierarchyOptimization.filterHierarchyRelationships(trees);
      
      // Assert
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
      expect(filtered[0].children.length).toBe(1);
    });
    
    test('应该过滤高相似度的父子关系', () => {
      // Arrange: Mock 按空格分词，相似度 = 共同词数/总词数；需 >= 0.7 才会过滤。用 "a b c" 与 "a b c d" 得 3/4=0.75
      const trees = [
        {
          id: 1,
          name: 'a b c',
          confidence: 0.8,
          children: [
            {
              id: 2,
              name: 'a b c d',
              confidence: 0.9,
              children: []
            }
          ]
        }
      ];
      
      // Act
      const filtered = hierarchyOptimization.filterHierarchyRelationships(trees);
      
      // Assert
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
      expect(filtered[0].children.length).toBe(0); // 子节点应该被过滤
    });
    
    test('应该保留低相似度的父子关系', () => {
      // Arrange
      const trees = [
        {
          id: 1,
          name: 'AI',
          confidence: 0.8,
          children: [
            {
              id: 2,
              name: '机器学习',
              confidence: 0.9,
              children: []
            }
          ]
        }
      ];
      
      // Act
      const filtered = hierarchyOptimization.filterHierarchyRelationships(trees);
      
      // Assert
      expect(filtered.length).toBe(1);
      expect(filtered[0].children.length).toBe(1); // 子节点应该保留
    });
  });
  
  describe('父子相似度计算', () => {
    test('应该正确计算父子相似度', () => {
      // Arrange: Mock 按空格分词，用英文保证有共同词
      const parent = { name: 'machine learning' };
      const child = { name: 'machine learning research' };
      
      // Act
      const similarity = hierarchyOptimization.calculateParentChildSimilarity(child, parent);
      
      // Assert
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
    
    test('应该计算无共同词的相似度', () => {
      // Arrange: Mock 按空格分词，无共同 token 时相似度为 0
      const parent = { name: '机器学习' };
      const child = { name: '深度学习' };
      
      // Act
      const similarity = hierarchyOptimization.calculateParentChildSimilarity(child, parent);
      
      // Assert
      expect(similarity).toBe(0);
    });
    
    test('应该处理空名称', () => {
      // Arrange
      const parent = { name: '' };
      const child = { name: '机器学习' };
      
      // Act
      const similarity = hierarchyOptimization.calculateParentChildSimilarity(child, parent);
      
      // Assert
      expect(similarity).toBe(0);
    });
  });
  
  describe('深度计算', () => {
    test('应该正确计算树的深度', () => {
      // Arrange
      const tree = {
        id: 1,
        name: 'AI',
        children: [
          {
            id: 2,
            name: '机器学习',
            children: [
              {
                id: 3,
                name: '深度学习',
                children: []
              }
            ]
          }
        ]
      };
      
      // Act
      const depth = hierarchyOptimization.calculateDepth(tree);
      
      // Assert
      expect(depth).toBe(3);
    });
    
    test('应该计算单节点树的深度', () => {
      // Arrange
      const tree = {
        id: 1,
        name: 'AI',
        children: []
      };
      
      // Act
      const depth = hierarchyOptimization.calculateDepth(tree);
      
      // Assert
      expect(depth).toBe(1);
    });
  });
  
  describe('祖先节点获取', () => {
    test('应该正确获取祖先节点', () => {
      // Arrange: 分步构建避免 parent: tree 自引用
      const root = { id: 1, name: 'AI', children: [] };
      const child = { id: 2, name: '机器学习', parent: root, children: [] };
      root.children.push(child);
      const grandchild = { id: 3, name: '深度学习', parent: child, children: [] };
      child.children.push(grandchild);
      
      // Act
      const ancestors = hierarchyOptimization.getAncestorNodes(grandchild);
      
      // Assert
      expect(ancestors.length).toBe(2); // child, root
    });
  });
  
  describe('层次结构配置', () => {
    test('应该使用正确的配置', () => {
      // Act
      const config = hierarchyOptimization.config;
      
      // Assert
      expect(config.parentChildSimilarityThreshold).toBe(0.7);
      expect(config.minParentConfidence).toBe(0.3);
      expect(config.childInheritanceFactor).toBe(0.5);
      expect(config.maxDepth).toBe(5);
    });
  });
  
  describe('层次结构边界条件', () => {
    test('应该处理null输入', () => {
      // Act
      const optimized = hierarchyOptimization.applyHierarchyOptimization(null);
      
      // Assert
      expect(optimized).toBeNull();
    });
    
    test('应该处理undefined输入', () => {
      // Act
      const optimized = hierarchyOptimization.applyHierarchyOptimization(undefined);
      
      // Assert
      expect(optimized).toBeUndefined();
    });
    
    test('应该处理没有子节点的树', () => {
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
      const optimized = hierarchyOptimization.applyHierarchyOptimization(trees);
      
      // Assert
      expect(optimized.length).toBe(1);
      expect(optimized[0].confidence).toBe(0.8);
    });
  });
});
