import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  bail: true,
  testTimeout: 30000,
  verbose: true,
  modulePathIgnorePatterns: ['mocks'],
  preset: 'ts-jest',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.esm.json' }],
  },
};

export default jestConfig;
