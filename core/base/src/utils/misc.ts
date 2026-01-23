export function lazyInstantiate<T>(factory: () => T): () => T {
  let instance: T | null = null;
  return () => {
    if (!instance)
      instance = factory();
    return instance;
  }
}

export function onlyOnce<T extends []>(fn: (...args: T) => any, ...args: T): () => void {
  let called = false;
  return () => {
    if (!called) {
      called = true;
      fn(...args);
    }
  }
}

export function throws(fn: () => any): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export function bound(value: number, min: number, max: number): number;
export function bound(value: bigint, min: bigint, max: bigint): bigint;
export function bound(
  value: number | bigint,
  min: number | bigint,
  max: number | bigint,
): number | bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
