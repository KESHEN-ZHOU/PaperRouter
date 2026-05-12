describe('Background Embedding Task Integration', () => {
  let backgroundTask;
  let mockNotifier;
  let mockTimeout;
  
  beforeEach(() => {
    mockTimeout = jest.fn((callback, delay) => {
      if (delay === 0) {
        callback();
        return 1;
      }
      return setTimeout(callback, 0);
    });
    global.setTimeout = mockTimeout;
    
    mockNotifier = {
      addObserver: jest.fn(),
      removeObserver: jest.fn()
    };
    
    backgroundTask = {
      queue: new Map(),
      processing: false,
      initialized: false,
      
      config: {
        maxQueueSize: 100,
        processingInterval: 1000,
        maxRetries: 3,
        batchSize: 10
      },
      
      init() {
        if (this.initialized) return;
        this.initialized = true;
        this.startProcessing();
      },
      
      startProcessing() {
        if (this.processing) return;
        this.processing = true;
        this.processQueue();
      },
      
      stopProcessing() {
        this.processing = false;
      },
      
      async processQueue() {
        if (!this.processing) return;
        
        if (this.queue.size === 0) {
          setTimeout(() => this.processQueue(), this.config.processingInterval);
          return;
        }
        
        const tasks = Array.from(this.queue.values())
          .sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))
          .slice(0, this.config.batchSize);
        
        for (const task of tasks) {
          await this.processTask(task);
        }
        
        setTimeout(() => this.processQueue(), this.config.processingInterval);
      },
      
      async processTask(task) {
        try {
          if (task.retryCount >= this.config.maxRetries) {
            this.queue.delete(task.id);
            return;
          }
          
          await this.executeTask(task);
          this.queue.delete(task.id);
        } catch (error) {
          task.retryCount = (task.retryCount || 0) + 1;
          task.lastError = error;
          
          if (task.retryCount >= this.config.maxRetries) {
            this.queue.delete(task.id);
          }
        }
      },
      
      async executeTask(task) {
        if (task.type === 'collection') {
          await this.processCollectionTask(task);
        } else if (task.type === 'item') {
          await this.processItemTask(task);
        }
      },
      
      async processCollectionTask(task) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true });
          }, 100);
        });
      },
      
      async processItemTask(task) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true });
          }, 100);
        });
      },
      
      addToQueue(task) {
        if (this.queue.size >= this.config.maxQueueSize) {
          throw new Error('Queue is full');
        }
        
        const taskWithId = {
          id: Date.now() + Math.random(),
          ...task,
          retryCount: 0,
          createdAt: new Date()
        };
        
        this.queue.set(taskWithId.id, taskWithId);
        return taskWithId.id;
      },
      
      removeFromQueue(taskId) {
        return this.queue.delete(taskId);
      },
      
      getQueueSize() {
        return this.queue.size;
      },
      
      getQueueStatus() {
        const tasks = Array.from(this.queue.values());
        const pending = tasks.filter(t => t.retryCount === 0).length;
        const retrying = tasks.filter(t => t.retryCount > 0).length;
        
        return {
          total: this.queue.size,
          pending: pending,
          retrying: retrying
        };
      },
      
      getPriorityValue(priority) {
        const priorities = {
          'high': 3,
          'medium': 2,
          'low': 1
        };
        return priorities[priority] || 0;
      },
      
      clearQueue() {
        this.queue.clear();
      },
      
      async onCollectionChanged(action, collection) {
        if (action === 'add' || action === 'modify') {
          this.addToQueue({
            type: 'collection',
            collectionId: collection.id,
            collectionName: collection.name,
            priority: 'medium'
          });
        }
      },
      
      async onItemChanged(action, item) {
        if (action === 'add' || action === 'modify') {
          this.addToQueue({
            type: 'item',
            itemId: item.id,
            itemName: item.title,
            priority: 'low'
          });
        }
      }
    };
  });
  
  describe('后台任务流程', () => {
    test('应该完整执行后台任务流程', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      const taskId = backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        collectionName: '测试Collection',
        priority: 'high'
      });
      
      // Assert
      expect(taskId).toBeDefined();
      expect(backgroundTask.getQueueSize()).toBe(1);
    });
    
    test('应该启动处理流程', () => {
      // Act
      backgroundTask.init();
      
      // Assert
      expect(backgroundTask.initialized).toBe(true);
      expect(backgroundTask.processing).toBe(true);
    });
    
    test('应该停止处理流程', () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      backgroundTask.stopProcessing();
      
      // Assert
      expect(backgroundTask.processing).toBe(false);
    });
  });
  
  describe('任务队列管理', () => {
    test('应该正确添加任务到队列', () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      const taskId1 = backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      
      const taskId2 = backgroundTask.addToQueue({
        type: 'item',
        itemId: 2,
        priority: 'low'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(2);
      expect(taskId1).not.toBe(taskId2);
    });
    
    test('应该正确从队列移除任务', () => {
      // Arrange
      backgroundTask.init();
      const taskId = backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      
      // Act
      const removed = backgroundTask.removeFromQueue(taskId);
      
      // Assert
      expect(removed).toBe(true);
      expect(backgroundTask.getQueueSize()).toBe(0);
    });
    
    test('应该正确获取队列状态', () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 2,
        priority: 'medium'
      });
      
      // Act
      const status = backgroundTask.getQueueStatus();
      
      // Assert
      expect(status.total).toBe(2);
      expect(status.pending).toBe(2);
      expect(status.retrying).toBe(0);
    });
  });
  
  describe('任务优先级处理', () => {
    test('应该按优先级排序任务', () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'low'
      });
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 2,
        priority: 'high'
      });
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 3,
        priority: 'medium'
      });
      
      // Act
      const tasks = Array.from(backgroundTask.queue.values())
        .sort((a, b) => backgroundTask.getPriorityValue(b.priority) - backgroundTask.getPriorityValue(a.priority));
      
      // Assert
      expect(tasks[0].priority).toBe('high');
      expect(tasks[1].priority).toBe('medium');
      expect(tasks[2].priority).toBe('low');
    });
  });
  
  describe('任务重试机制', () => {
    test('应该在失败时重试任务', async () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.executeTask = jest.fn().mockRejectedValueOnce(new Error('Task failed'));
      
      const taskId = backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      
      // Act
      await backgroundTask.processTask(backgroundTask.queue.get(taskId));
      
      // Assert
      const task = backgroundTask.queue.get(taskId);
      expect(task.retryCount).toBe(1);
    });
    
    test('应该在达到最大重试次数后删除任务', async () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.executeTask = jest.fn().mockRejectedValue(new Error('Task failed'));
      
      const taskId = backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      
      // Act
      for (let i = 0; i < 4; i++) {
        const task = backgroundTask.queue.get(taskId);
        if (task) {
          await backgroundTask.processTask(task);
        }
      }
      
      // Assert
      expect(backgroundTask.queue.has(taskId)).toBe(false);
    });
  });
  
  describe('Collection变化监听', () => {
    test('应该处理Collection添加事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onCollectionChanged('add', {
        id: 1,
        name: '新Collection'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(1);
    });
    
    test('应该处理Collection修改事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onCollectionChanged('modify', {
        id: 1,
        name: '修改的Collection'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(1);
    });
    
    test('应该忽略Collection删除事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onCollectionChanged('delete', {
        id: 1,
        name: '删除的Collection'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(0);
    });
  });
  
  describe('Item变化监听', () => {
    test('应该处理Item添加事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onItemChanged('add', {
        id: 1,
        title: '新Item'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(1);
    });
    
    test('应该处理Item修改事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onItemChanged('modify', {
        id: 1,
        title: '修改的Item'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(1);
    });
    
    test('应该忽略Item删除事件', async () => {
      // Arrange
      backgroundTask.init();
      
      // Act
      await backgroundTask.onItemChanged('delete', {
        id: 1,
        title: '删除的Item'
      });
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(0);
    });
  });
  
  describe('任务执行', () => {
    test('应该正确执行Collection任务', async () => {
      // Arrange
      const task = {
        type: 'collection',
        collectionId: 1,
        collectionName: '测试Collection'
      };
      
      // Act
      const result = await backgroundTask.processCollectionTask(task);
      
      // Assert
      expect(result.success).toBe(true);
    });
    
    test('应该正确执行Item任务', async () => {
      // Arrange
      const task = {
        type: 'item',
        itemId: 1,
        itemName: '测试Item'
      };
      
      // Act
      const result = await backgroundTask.processItemTask(task);
      
      // Assert
      expect(result.success).toBe(true);
    });
  });
  
  describe('队列边界条件', () => {
    test('应该处理队列满的情况', () => {
      // Arrange
      backgroundTask.config.maxQueueSize = 2;
      backgroundTask.init();
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 2,
        priority: 'high'
      });
      
      // Act & Assert
      expect(() => {
        backgroundTask.addToQueue({
          type: 'collection',
          collectionId: 3,
          priority: 'high'
        });
      }).toThrow('Queue is full');
    });
    
    test('应该正确清空队列', () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 2,
        priority: 'high'
      });
      
      // Act
      backgroundTask.clearQueue();
      
      // Assert
      expect(backgroundTask.getQueueSize()).toBe(0);
    });
  });
  
  describe('后台任务配置', () => {
    test('应该使用正确的配置', () => {
      // Act
      const config = backgroundTask.config;
      
      // Assert
      expect(config.maxQueueSize).toBe(100);
      expect(config.processingInterval).toBe(1000);
      expect(config.maxRetries).toBe(3);
      expect(config.batchSize).toBe(10);
    });
  });
  
  describe('后台任务初始化', () => {
    test('应该正确初始化后台任务', () => {
      // Act
      backgroundTask.init();
      
      // Assert
      expect(backgroundTask.initialized).toBe(true);
      expect(backgroundTask.processing).toBe(true);
      expect(backgroundTask.queue.size).toBe(0);
    });
    
    test('应该避免重复初始化', () => {
      // Arrange
      backgroundTask.init();
      backgroundTask.addToQueue({
        type: 'collection',
        collectionId: 1,
        priority: 'high'
      });
      
      // Act
      backgroundTask.init();
      
      // Assert
      expect(backgroundTask.queue.size).toBe(1); // 数据应该保留
    });
  });
});
