export function lazyInstantiate<T>(factory: () => T): () => T {
  let instance: T | null = null;
  return () => {
    if (!instance)
      instance = factory();
    return instance;
  };
}

export function onlyOnce<T extends []>(fn: (...args: T) => any, ...args: T): () => void {
  let called = false;
  return () => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
}

export function throws(fn: () => any): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

/**
 * Maps an object to another by applying the given function to every "leaf" property
 * (_i.e._ neither object nor array).
 */
export function visitor(input: any, f: (property: any) => any): any {
  if (Array.isArray(input)) {
    return input.map((v) => visitor(v, f));
  } else if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, visitor(v, f)]));
  } else {
    return f(input);
  }
}
