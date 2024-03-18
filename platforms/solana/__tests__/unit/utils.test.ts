import { camelCase, upperFirst } from './../../src/index.js';

const camelCaseCases: [string, string][] = [
  ['foo', 'foo'],
  ['foo bar', 'fooBar'],
  ['foo barBaz', 'fooBarBaz'],
  ['foo bar baz', 'fooBarBaz'],
  ['foo-bar-baz', 'fooBarBaz'],
];

const upperFirstCases: [string, string][] = [
  ['foo', 'Foo'],
  ['fooBar', 'FooBar'],
  ['fooBarBaz', 'FooBarBaz'],
];
describe('Solana Utils tests', () => {
  test('Test camelCase function', () => {
    for (const [input, expected] of camelCaseCases) {
      expect(camelCase(input)).toBe(expected);
    }
  });
  test('Test upperFirst function', () => {
    for (const [input, expected] of upperFirstCases) {
      expect(upperFirst(input)).toBe(expected);
    }
  });
});
