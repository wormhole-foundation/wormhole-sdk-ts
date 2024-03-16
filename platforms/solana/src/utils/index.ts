export * as utils from './utils/index.js';
export * as anchor from './anchor/index.js';

// camel case a string (from https://stackoverflow.com/a/2970667)
export function camelCase(str: string): string {
  return (
    str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      // replace any spaces, hyphens, or underscores with an empty string
      .replace(/[\s\-_]+/g, '')
  );
}

export function upperFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
