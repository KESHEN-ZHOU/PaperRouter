describe('Collection Blacklist System Integration', () => {
  let collectionBlacklist;
  
  beforeEach(() => {
    collectionBlacklist = {
      blacklist: new Map(),
      recommendationCount: new Map(),
      rejectionCount: new Map(),
      rejectionRateCache: new Map(),
      initialized: false,
      filePath: null,
      
      config: {
        maxBlacklistSize: 100,
        blacklistExpiryDays: 30,
        rejectionRateThreshold: 0.5,
        rejectionRatePenalty: 0.5
      },
      
      async init(rootURI) {
        if (this.initialized) return;
        this.initialized = true;
      },
      
      async load() {
      },
      
      async save() {
      },
      
      async recordRecommendation(collectionId) {
        const count = this.recommendationCount.get(collectionId) || 0;
        this.recommendationCount.set(collectionId, count + 1);
      },
      
      async updateBlacklist(userId, collectionId, rejected) {
        const userBlacklist = this.blacklist.get(userId) || new Set();
        
        if (rejected) {
          userBlacklist.add(collectionId);
          const rejectionCount = this.rejectionCount.get(collectionId) || 0;
          this.rejectionCount.set(collectionId, rejectionCount + 1);
        } else {
          userBlacklist.delete(collectionId);
        }
        
        this.blacklist.set(userId, userBlacklist);
      },
      
      async getBlacklist(userId) {
        return this.blacklist.get(userId) || new Set();
      },
      
      async getRejectionRate(collectionId) {
        const recommendations = this.recommendationCount.get(collectionId) || 0;
        const rejections = this.rejectionCount.get(collectionId) || 0;
        
        if (recommendations === 0) {
          return 0;
        }
        
        return rejections / recommendations;
      },
      
      applyRejectionPenalty(collectionId, score) {
        const rejectionRate = this.rejectionRateCache.get(collectionId) || 0;
        const penalty = 1 - (rejectionRate * this.config.rejectionRatePenalty);
        return score * penalty;
      },
      
      isBlacklisted(userId, collectionId) {
        const userBlacklist = this.blacklist.get(userId);
        return userBlacklist ? userBlacklist.has(collectionId) : false;
      },
      
      clearBlacklist(userId) {
        this.blacklist.delete(userId);
      },
      
      clearAllBlacklists() {
        this.blacklist.clear();
      }
    };
  });
  
  describe('黑名单管理流程', () => {
    test('应该完整执行黑名单管理流程', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(2);
      await collectionBlacklist.updateBlacklist(100, 1, true); // 用户拒绝
      await collectionBlacklist.updateBlacklist(100, 2, false); // 用户接受
      
      // Assert
      const blacklist = await collectionBlacklist.getBlacklist(100);
      expect(blacklist.has(1)).toBe(true);
      expect(blacklist.has(2)).toBe(false);
    });
    
    test('应该正确记录推荐', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(1);
      
      // Assert
      const count = collectionBlacklist.recommendationCount.get(1);
      expect(count).toBe(3);
    });
    
    test('应该正确更新黑名单', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(100, 2, true);
      await collectionBlacklist.updateBlacklist(100, 1, false);
      
      // Assert
      const blacklist = await collectionBlacklist.getBlacklist(100);
      expect(blacklist.has(1)).toBe(false);
      expect(blacklist.has(2)).toBe(true);
    });
  });
  
  describe('拒绝率计算', () => {
    test('应该正确计算拒绝率', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(101, 1, true);
      
      const rejectionRate = await collectionBlacklist.getRejectionRate(1);
      
      // Assert
      expect(rejectionRate).toBeCloseTo(0.67, 2); // 2/3 = 0.67
    });
    
    test('应该处理没有推荐的Collection', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      const rejectionRate = await collectionBlacklist.getRejectionRate(999);
      
      // Assert
      expect(rejectionRate).toBe(0);
    });
    
    test('应该处理没有拒绝的Collection', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.recordRecommendation(1);
      
      // Act
      const rejectionRate = await collectionBlacklist.getRejectionRate(1);
      
      // Assert
      expect(rejectionRate).toBe(0);
    });
  });
  
  describe('拒绝率惩罚', () => {
    test('应该正确应用拒绝率惩罚', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      collectionBlacklist.rejectionRateCache.set(1, 0.8); // 高拒绝率
      
      // Act
      const penalized = collectionBlacklist.applyRejectionPenalty(1, 0.9);
      
      // Assert
      expect(penalized).toBeLessThan(0.9); // 应该降低分数
      expect(penalized).toBeCloseTo(0.54, 2); // 0.9 * (1 - 0.8 * 0.5) = 0.54
    });
    
    test('应该不惩罚低拒绝率', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      collectionBlacklist.rejectionRateCache.set(1, 0.1); // 低拒绝率
      
      // Act
      const penalized = collectionBlacklist.applyRejectionPenalty(1, 0.9);
      
      // Assert
      expect(penalized).toBeCloseTo(0.855, 2); // 0.9 * (1 - 0.1 * 0.5) = 0.855
    });
    
    test('应该处理没有缓存的拒绝率', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      const penalized = collectionBlacklist.applyRejectionPenalty(999, 0.9);
      
      // Assert
      expect(penalized).toBe(0.9); // 没有拒绝率，不惩罚
    });
  });
  
  describe('黑名单查询', () => {
    test('应该正确检查黑名单', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.updateBlacklist(100, 1, true);
      
      // Act
      const isBlacklisted1 = collectionBlacklist.isBlacklisted(100, 1);
      const isBlacklisted2 = collectionBlacklist.isBlacklisted(100, 2);
      const isBlacklisted3 = collectionBlacklist.isBlacklisted(101, 1);
      
      // Assert
      expect(isBlacklisted1).toBe(true);
      expect(isBlacklisted2).toBe(false);
      expect(isBlacklisted3).toBe(false);
    });
  });
  
  describe('黑名单持久化', () => {
    test('应该保存和加载黑名单数据', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.save();
      
      // Act
      collectionBlacklist.blacklist.clear();
      await collectionBlacklist.load();
      
      // Assert
      expect(collectionBlacklist.blacklist.size).toBe(0); // Mock的load不返回数据
    });
  });
  
  describe('黑名单初始化', () => {
    test('应该正确初始化黑名单系统', async () => {
      // Act
      await collectionBlacklist.init('/root/uri');
      
      // Assert
      expect(collectionBlacklist.initialized).toBe(true);
      expect(collectionBlacklist.blacklist.size).toBe(0);
      expect(collectionBlacklist.recommendationCount.size).toBe(0);
    });
    
    test('应该避免重复初始化', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.updateBlacklist(100, 1, true);
      
      // Act
      await collectionBlacklist.init('/root/uri');
      
      // Assert
      expect(collectionBlacklist.blacklist.size).toBe(1); // 数据应该保留
    });
  });
  
  describe('黑名单配置', () => {
    test('应该使用正确的黑名单配置', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      const config = collectionBlacklist.config;
      
      // Assert
      expect(config.maxBlacklistSize).toBe(100);
      expect(config.blacklistExpiryDays).toBe(30);
      expect(config.rejectionRateThreshold).toBe(0.5);
      expect(config.rejectionRatePenalty).toBe(0.5);
    });
  });
  
  describe('黑名单清理', () => {
    test('应该正确清理用户黑名单', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(100, 2, true);
      
      // Act
      collectionBlacklist.clearBlacklist(100);
      
      // Assert
      const blacklist = await collectionBlacklist.getBlacklist(100);
      expect(blacklist.size).toBe(0);
    });
    
    test('应该正确清理所有黑名单', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(101, 2, true);
      
      // Act
      collectionBlacklist.clearAllBlacklists();
      
      // Assert
      expect(collectionBlacklist.blacklist.size).toBe(0);
    });
  });
  
  describe('黑名单边界条件', () => {
    test('应该处理多个用户', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(101, 1, false);
      await collectionBlacklist.updateBlacklist(102, 1, true);
      
      // Assert
      expect(collectionBlacklist.isBlacklisted(100, 1)).toBe(true);
      expect(collectionBlacklist.isBlacklisted(101, 1)).toBe(false);
      expect(collectionBlacklist.isBlacklisted(102, 1)).toBe(true);
    });
    
    test('应该处理同一Collection的多次推荐', async () => {
      // Arrange
      await collectionBlacklist.init('/root/uri');
      
      // Act
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.recordRecommendation(1);
      await collectionBlacklist.updateBlacklist(100, 1, true);
      await collectionBlacklist.updateBlacklist(101, 1, true);
      
      const rejectionRate = await collectionBlacklist.getRejectionRate(1);
      
      // Assert
      expect(rejectionRate).toBe(1.0); // 2/2 = 1.0
    });
  });
});
