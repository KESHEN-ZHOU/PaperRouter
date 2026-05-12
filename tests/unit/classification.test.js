describe('Collection Type Classification', () => {
  let classifyCollectionTypeVector;
  
  beforeEach(() => {
      classifyCollectionTypeVector = function(collectionName, collectionDescription) {
        if (!collectionName && !collectionDescription) {
          return 'default';
        }
        
        const name = collectionName || '';
        const description = collectionDescription || '';
        
        if (name.startsWith('--')) {
          return 'external';
        }
        
        const externalKeywords = [
          '会议', 'Conference', '会议论文', '顶会', '顶刊',
          'AAAI', 'ACL', 'ICML', 'NeurIPS', 'CVPR', 'ICCV',
          'ECCV', 'IJCAI', 'SIGIR', 'WWW', 'KDD'
        ];
        
        for (const keyword of externalKeywords) {
          if (name.includes(keyword) || description.includes(keyword)) {
            return 'external';
          }
        }
        
        const internalKeywords = [
          '机器学习', '深度学习', '自然语言处理', '计算机视觉',
          'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
          '人工智能', 'AI', '强化学习', 'Reinforcement Learning'
        ];
        
        for (const keyword of internalKeywords) {
          if (name.includes(keyword) || description.includes(keyword)) {
            return 'internal';
          }
        }
        
        return 'default';
      };
    });
  
  describe('external collections', () => {
    test('should classify collection starting with --', () => {
      const result = classifyCollectionTypeVector(
        '--顶会顶刊论文集',
        '顶会顶刊论文集'
      );
      expect(result).toBe('external');
    });
    
    test('should classify conference collections', () => {
      const result = classifyCollectionTypeVector(
        'AAAI',
        'AAAI会议论文'
      );
      expect(result).toBe('external');
    });
    
    test('should classify ACL conference', () => {
      const result = classifyCollectionTypeVector(
        'ACL',
        'ACL会议论文'
      );
      expect(result).toBe('external');
    });
    
    test('should classify ICML conference', () => {
      const result = classifyCollectionTypeVector(
        'ICML',
        'ICML会议论文'
      );
      expect(result).toBe('external');
    });
    
    test('should classify CVPR conference', () => {
      const result = classifyCollectionTypeVector(
        'CVPR',
        'CVPR会议论文'
      );
      expect(result).toBe('external');
    });
  });
  
  describe('internal collections', () => {
    test('should classify machine learning collection', () => {
      const result = classifyCollectionTypeVector(
        '机器学习',
        '机器学习相关论文'
      );
      expect(result).toBe('internal');
    });
    
    test('should classify deep learning collection', () => {
      const result = classifyCollectionTypeVector(
        '深度学习',
        '深度学习相关论文'
      );
      expect(result).toBe('internal');
    });
    
    test('should classify NLP collection', () => {
      const result = classifyCollectionTypeVector(
        '自然语言处理',
        '自然语言处理相关论文'
      );
      expect(result).toBe('internal');
    });
    
    test('should classify computer vision collection', () => {
      const result = classifyCollectionTypeVector(
        '计算机视觉',
        '计算机视觉相关论文'
      );
      expect(result).toBe('internal');
    });
    
    test('should classify AI collection', () => {
      const result = classifyCollectionTypeVector(
        '人工智能',
        '人工智能相关论文'
      );
      expect(result).toBe('internal');
    });
  });
  
  describe('boundary cases', () => {
    test('should handle empty strings', () => {
      const result = classifyCollectionTypeVector('', '');
      expect(result).toBe('default');
    });
    
    test('should handle null inputs', () => {
      const result = classifyCollectionTypeVector(null, null);
      expect(result).toBe('default');
    });
    
    test('should handle undefined inputs', () => {
      const result = classifyCollectionTypeVector(undefined, undefined);
      expect(result).toBe('default');
    });
    
    test('should handle only collection name', () => {
      const result = classifyCollectionTypeVector('机器学习', '');
      expect(result).toBe('internal');
    });
    
    test('should handle only collection description', () => {
      const result = classifyCollectionTypeVector('', '机器学习相关论文');
      expect(result).toBe('internal');
    });
  });
  
  describe('default collections', () => {
    test('should classify generic collection as default', () => {
      const result = classifyCollectionTypeVector(
        '测试集合',
        '测试描述'
      );
      expect(result).toBe('default');
    });
    
    test('should classify unknown collection as default', () => {
      const result = classifyCollectionTypeVector(
        'Unknown Collection',
        'Unknown Description'
      );
      expect(result).toBe('default');
    });
    
    test('should classify random collection as default', () => {
      const result = classifyCollectionTypeVector(
        'Random Stuff',
        'Random Description'
      );
      expect(result).toBe('default');
    });
  });
  
  describe('mixed cases', () => {
    test('should prioritize external keyword', () => {
      const result = classifyCollectionTypeVector(
        'AAAI机器学习',
        'AAAI会议机器学习论文'
      );
      expect(result).toBe('external');
    });
    
    test('should prioritize -- prefix', () => {
      const result = classifyCollectionTypeVector(
        '--机器学习',
        '机器学习相关论文'
      );
      expect(result).toBe('external');
    });
  });
});
