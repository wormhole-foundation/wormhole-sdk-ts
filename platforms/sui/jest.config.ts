import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  verbose: true,
  testTimeout: 60000,
  // @mysten/sui v2 is ESM-only; run ts-jest in ESM mode so its `import`
  // conditions resolve and the modules load natively under --experimental-vm-modules.
  extensionsToTreatAsEsm: [".ts"],
  modulePathIgnorePatterns: ["mocks"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.esm.json", useESM: true, diagnostics: false }],
  },
};

export default jestConfig;
