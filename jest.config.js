module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'PaperRouter/**/*.js',
    '!PaperRouter/**/node_modules/**',
    '!PaperRouter/**/*.test.js',
    '!PaperRouter/**/*.md'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/'
  ],
  transform: {},
  globals: {
    'test-url': 'http://localhost'
  }
};
