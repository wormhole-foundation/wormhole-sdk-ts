import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  verbose: true,
  modulePathIgnorePatterns: ["mocks"],
  transform: {},
};

export default jestConfig;
