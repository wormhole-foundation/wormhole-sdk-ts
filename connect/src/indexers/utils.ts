import { encoding } from "@wormhole-foundation/sdk-base";

export function parseBalance(balance: string | undefined): bigint | null {
  try {
    if (!balance) {
      return null;
    }

    const trimmedBalance = balance.trim();
    if (trimmedBalance === "0x") {
      return 0n;
    }
    return encoding.bignum.decode(trimmedBalance);
  } catch {
    return null;
  }
}
