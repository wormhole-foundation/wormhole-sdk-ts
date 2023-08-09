module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: '.coverage',
  verbose: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
};
