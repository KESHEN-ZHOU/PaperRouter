describe('Similarity Calculation', () => {
  let cosineSimilarity;
  
  beforeEach(() => {
    cosineSimilarity = function(vec1, vec2) {
      if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
        return 0;
      }
      
      if (vec1.length !== vec2.length) {
        return 0;
      }
      
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
      }
      
      if (norm1 === 0 || norm2 === 0) {
        return 0;
      }
      
      return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    };
  });
  
  describe('cosineSimilarity', () => {
    test('should calculate correct similarity for identical vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should calculate zero for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(0.0, 4);
    });
    
    test('should calculate correct similarity for similar vectors', () => {
      const vec1 = [1, 1, 0];
      const vec2 = [1, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(0.7071, 4);
    });
    
    test('should calculate correct similarity for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(-1.0, 4);
    });
    
    test('should handle 2D vectors', () => {
      const vec1 = [3, 4];
      const vec2 = [6, 8];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should handle 4D vectors', () => {
      const vec1 = [1, 2, 3, 4];
      const vec2 = [2, 4, 6, 8];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
  });
  
  describe('boundary cases', () => {
    test('should handle empty vectors', () => {
      const vec1 = [];
      const vec2 = [];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBe(0);
    });
    
    test('should handle null vectors', () => {
      const result = cosineSimilarity(null, null);
      expect(result).toBe(0);
    });
    
    test('should handle undefined vectors', () => {
      const result = cosineSimilarity(undefined, undefined);
      expect(result).toBe(0);
    });
    
    test('should handle vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBe(0);
    });
    
    test('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [0, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBe(0);
    });
    
    test('should handle one zero vector', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [0, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBe(0);
    });
  });
  
  describe('edge cases', () => {
    test('should handle very small values', () => {
      const vec1 = [0.0001, 0.0002, 0.0003];
      const vec2 = [0.0001, 0.0002, 0.0003];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should handle very large values', () => {
      const vec1 = [1000000, 2000000, 3000000];
      const vec2 = [1000000, 2000000, 3000000];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should handle negative values', () => {
      const vec1 = [-1, -2, -3];
      const vec2 = [-1, -2, -3];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should handle mixed positive and negative values', () => {
      const vec1 = [1, -2, 3];
      const vec2 = [1, -2, 3];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
  });
  
  describe('similarity ranges', () => {
    test('should return value between -1 and 1', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });
    
    test('should return 1 for identical vectors', () => {
      const vec1 = [1, 2, 3, 4, 5];
      const vec2 = [1, 2, 3, 4, 5];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
    
    test('should return -1 for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(-1.0, 4);
    });
  });
  
  describe('precision', () => {
    test('should maintain precision for floating point calculations', () => {
      const vec1 = [0.1, 0.2, 0.3];
      const vec2 = [0.4, 0.5, 0.6];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(0.9746, 4);
    });
    
    test('should handle irrational numbers', () => {
      const vec1 = [Math.sqrt(2), Math.sqrt(3), Math.sqrt(5)];
      const vec2 = [Math.sqrt(2), Math.sqrt(3), Math.sqrt(5)];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(1.0, 4);
    });
  });
});
