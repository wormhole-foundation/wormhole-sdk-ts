import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  verbose: true,
  modulePathIgnorePatterns: ["mocks", "helpers", "staging", "typechecks"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.esm.json" }],
  },
};

export default jestConfig;
