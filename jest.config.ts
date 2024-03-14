import type { JestConfigWithTsJest } from "jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  verbose: true,
  modulePathIgnorePatterns: ["mocks", "helpers", "staging", "typechecks"],
  transform: {},
};

export default jestConfig;
