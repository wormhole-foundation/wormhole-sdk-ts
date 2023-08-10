module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: '.coverage',
  verbose: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {//the content you'd placed at "global"
      babel: true,
      tsconfig: 'tsconfig.json',
    }]
  },
};