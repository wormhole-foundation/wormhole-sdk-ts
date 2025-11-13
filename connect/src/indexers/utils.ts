export function parseBalance(balance: string | undefined): bigint | null {
  try {
    if (!balance) {
      return null;
    }
    return BigInt(balance.trim());
  } catch {
    return null;
  }
}
