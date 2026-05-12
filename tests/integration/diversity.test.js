describe('Diversity Control Integration', () => {
  let diversityControl;
  
  beforeEach(() => {
    diversityControl = {
      config: {
        maxCollections: 3,
        internalRatio: 0.7,
        minExternalCollections: 1,
        diversityWeight: 0.3
      },
      
      applyDiversityControl(collections, maxCollections) {
        if (!collections || collections.length === 0) {
          return [];
        }
        
        const limit = maxCollections || this.config.maxCollections;
        const sorted = [...collections].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        
        const internal = sorted.filter(c => c.type === 'internal');
        const external = sorted.filter(c => c.type === 'external');
        
        let maxInternal = Math.floor(limit * this.config.internalRatio);
        let maxExternal = limit - maxInternal;
        if (internal.length === 0) {
          maxInternal = 0;
          maxExternal = limit;
        } else if (external.length === 0) {
          maxExternal = 0;
          maxInternal = limit;
        }
        
        const selectedInternal = internal.slice(0, maxInternal);
        const selectedExternal = external.slice(0, maxExternal);
        
        const selected = [...selectedInternal, ...selectedExternal];
        
        return selected.slice(0, limit);
      },
      
      applyDiversityWeight(collections) {
        if (!collections || collections.length === 0) {
          return [];
        }
        
        const typeCounts = {};
        collections.forEach(c => {
          typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        });
        
        return collections.map(c => {
          const typeCount = typeCounts[c.type];
          const diversityPenalty = 1 - (typeCount - 1) * this.config.diversityWeight;
          const adjustedConfidence = (c.confidence || 0) * Math.max(0.5, diversityPenalty);
          return { ...c, adjustedConfidence };
        });
      },
      
      ensureMinimumDiversity(collections, minInternal, minExternal) {
        if (!collections || collections.length === 0) {
          return [];
        }
        
        const internal = collections.filter(c => c.type === 'internal');
        const external = collections.filter(c => c.type === 'external');
        
        const result = [...collections];
        
        if (internal.length < minInternal) {
          const needed = minInternal - internal.length;
          for (let i = 0; i < needed; i++) {
            result.push({ ...collections[i % collections.length], type: 'internal' });
          }
        }
        
        if (external.length < minExternal) {
          const needed = minExternal - external.length;
          for (let i = 0; i < needed; i++) {
            result.push({ ...collections[i % collections.length], type: 'external' });
          }
        }
        
        return result;
      },
      
      calculateDiversityScore(collections) {
        if (!collections || collections.length === 0) {
          return 0;
        }
        
        const typeCounts = {};
        collections.forEach(c => {
          typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        });
        
        const typeCount = Object.keys(typeCounts).length;
        const maxPossibleTypes = 2; // internal and external
        const diversityScore = typeCount / maxPossibleTypes;
        
        return diversityScore;
      },
      
      sortByDiversity(collections) {
        if (!collections || collections.length === 0) {
          return [];
        }
        
        const diversityScores = {};
        collections.forEach(c => {
          diversityScores[c.id] = this.calculateDiversityScore([c]);
        });
        
        return [...collections].sort((a, b) => {
          const scoreDiff = (b.adjustedConfidence || b.confidence || 0) - (a.adjustedConfidence || a.confidence || 0);
          if (Math.abs(scoreDiff) > 0.1) {
            return scoreDiff;
          }
          return (b.confidence || 0) - (a.confidence || 0);
        });
      }
    };
  });
  
  describe('多样性控制流程', () => {
    test('应该正确应用多样性控制', () => {
      // Arrange
      const collections = [
        { id: 1, name: '--顶会顶刊论文集', type: 'external', confidence: 0.9 },
        { id: 2, name: 'AAAI', type: 'external', confidence: 0.8 },
        { id: 3, name: '机器学习', type: 'internal', confidence: 0.7 },
        { id: 4, name: '深度学习', type: 'internal', confidence: 0.6 },
        { id: 5, name: '自然语言处理', type: 'internal', confidence: 0.5 }
      ];
      
      // Act
      const selected = diversityControl.applyDiversityControl(collections, 3);
      
      // Assert
      expect(selected.length).toBe(3);
      
      const internalCount = selected.filter(c => c.type === 'internal').length;
      const externalCount = selected.filter(c => c.type === 'external').length;
      
      expect(internalCount).toBeGreaterThanOrEqual(2); // 至少70%为内在含义型
      expect(externalCount).toBeLessThanOrEqual(1); // 最多30%为外在描述型
    });
    
    test('应该按置信度排序', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.5 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.9 },
        { id: 3, name: '自然语言处理', type: 'internal', confidence: 0.7 }
      ];
      
      // Act
      const selected = diversityControl.applyDiversityControl(collections, 2);
      
      // Assert
      expect(selected[0].confidence).toBeGreaterThan(selected[1].confidence);
    });
  });
  
  describe('多样性权重应用', () => {
    test('应该正确应用多样性权重', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8 },
        { id: 3, name: '自然语言处理', type: 'internal', confidence: 0.7 }
      ];
      
      // Act
      const weighted = diversityControl.applyDiversityWeight(collections);
      
      // Assert
      expect(weighted.length).toBe(3);
      expect(weighted[0].adjustedConfidence).toBeLessThan(0.9); // 应该降低
      expect(weighted[1].adjustedConfidence).toBeLessThan(0.8);
      expect(weighted[2].adjustedConfidence).toBeLessThan(0.7);
    });
    
    test('应该处理不同类型的Collection', () => {
      // Arrange
      const collections = [
        { id: 1, name: '--顶会顶刊论文集', type: 'external', confidence: 0.9 },
        { id: 2, name: '机器学习', type: 'internal', confidence: 0.8 }
      ];
      
      // Act
      const weighted = diversityControl.applyDiversityWeight(collections);
      
      // Assert
      expect(weighted.length).toBe(2);
      expect(weighted[0].adjustedConfidence).toBe(0.9); // 单个类型不应该降低
      expect(weighted[1].adjustedConfidence).toBe(0.8);
    });
  });
  
  describe('最小多样性保证', () => {
    test('应该保证最小内在含义型Collection数量', () => {
      // Arrange
      const collections = [
        { id: 1, name: '--顶会顶刊论文集', type: 'external', confidence: 0.9 },
        { id: 2, name: 'AAAI', type: 'external', confidence: 0.8 }
      ];
      
      // Act
      const result = diversityControl.ensureMinimumDiversity(collections, 1, 1);
      
      // Assert
      const internalCount = result.filter(c => c.type === 'internal').length;
      expect(internalCount).toBeGreaterThanOrEqual(1);
    });
    
    test('应该保证最小外在描述型Collection数量', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8 }
      ];
      
      // Act
      const result = diversityControl.ensureMinimumDiversity(collections, 1, 1);
      
      // Assert
      const externalCount = result.filter(c => c.type === 'external').length;
      expect(externalCount).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('多样性分数计算', () => {
    test('应该正确计算多样性分数', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '--顶会顶刊论文集', type: 'external', confidence: 0.8 }
      ];
      
      // Act
      const score = diversityControl.calculateDiversityScore(collections);
      
      // Assert
      expect(score).toBe(1.0); // 两种类型都有
    });
    
    test('应该计算单一类型的多样性分数', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8 }
      ];
      
      // Act
      const score = diversityControl.calculateDiversityScore(collections);
      
      // Assert
      expect(score).toBe(0.5); // 只有一种类型
    });
    
    test('应该处理空列表', () => {
      // Act
      const score = diversityControl.calculateDiversityScore([]);
      
      // Assert
      expect(score).toBe(0);
    });
  });
  
  describe('多样性排序', () => {
    test('应该按多样性权重排序', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9, adjustedConfidence: 0.85 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8, adjustedConfidence: 0.75 },
        { id: 3, name: '自然语言处理', type: 'internal', confidence: 0.7, adjustedConfidence: 0.65 }
      ];
      
      // Act
      const sorted = diversityControl.sortByDiversity(collections);
      
      // Assert
      expect(sorted[0].adjustedConfidence).toBeGreaterThan(sorted[1].adjustedConfidence);
      expect(sorted[1].adjustedConfidence).toBeGreaterThan(sorted[2].adjustedConfidence);
    });
  });
  
  describe('多样性边界条件', () => {
    test('应该处理全外在描述型情况', () => {
      // Arrange
      const collections = [
        { id: 1, name: '--顶会顶刊论文集', type: 'external', confidence: 0.9 },
        { id: 2, name: 'AAAI', type: 'external', confidence: 0.8 },
        { id: 3, name: 'ACL', type: 'external', confidence: 0.7 }
      ];
      
      // Act
      const selected = diversityControl.applyDiversityControl(collections, 3);
      
      // Assert
      expect(selected.length).toBe(3); // 即使全是外在描述型，也应该返回结果
    });
    
    test('应该处理全内在含义型情况', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8 },
        { id: 3, name: '自然语言处理', type: 'internal', confidence: 0.7 }
      ];
      
      // Act
      const selected = diversityControl.applyDiversityControl(collections, 3);
      
      // Assert
      expect(selected.length).toBe(3);
      expect(selected.every(c => c.type === 'internal')).toBe(true);
    });
    
    test('应该处理空列表', () => {
      // Act
      const selected = diversityControl.applyDiversityControl([], 3);
      
      // Assert
      expect(selected).toEqual([]);
    });
    
    test('应该处理null输入', () => {
      // Act
      const selected = diversityControl.applyDiversityControl(null, 3);
      
      // Assert
      expect(selected).toEqual([]);
    });
  });
  
  describe('多样性配置', () => {
    test('应该使用正确的多样性配置', () => {
      // Act
      const config = diversityControl.config;
      
      // Assert
      expect(config.maxCollections).toBe(3);
      expect(config.internalRatio).toBe(0.7);
      expect(config.minExternalCollections).toBe(1);
      expect(config.diversityWeight).toBe(0.3);
    });
  });
  
  describe('多样性权重范围', () => {
    test('应该在合理范围内应用权重', () => {
      // Arrange
      const collections = [
        { id: 1, name: '机器学习', type: 'internal', confidence: 0.9 },
        { id: 2, name: '深度学习', type: 'internal', confidence: 0.8 }
      ];
      
      // Act
      const weighted = diversityControl.applyDiversityWeight(collections);
      
      // Assert
      expect(weighted[0].adjustedConfidence).toBeGreaterThanOrEqual(0.9 * 0.5); // 最小权重
      expect(weighted[0].adjustedConfidence).toBeLessThanOrEqual(0.9); // 最大权重
    });
  });
});
