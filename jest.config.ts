import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  verbose: true,
  modulePathIgnorePatterns: ["mocks", "helpers", "staging", "typechecks"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
      },
    ],
  },
};

export default jestConfig;
