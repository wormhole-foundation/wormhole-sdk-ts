import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  verbose: true,
  testTimeout: 60000,
  extensionsToTreatAsEsm: ['.ts'],
  modulePathIgnorePatterns: ['mocks'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.esm.json', useESM: true, diagnostics: false }],
  },
};

export default jestConfig;
