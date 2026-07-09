import { describe, expect, test } from "@jest/globals";
import { retry } from "../src/tasks.js";

// Short interval/timeout so tests run fast
const INTERVAL = 10;
const TIMEOUT = 200;

describe("retry", () => {
  test("resolves immediately on first success", async () => {
    const result = await retry(async () => 42, INTERVAL, TIMEOUT);
    expect(result).toBe(42);
  });

  test("resolves after retrying null results", async () => {
    let attempts = 0;
    const result = await retry(async () => (++attempts < 3 ? null : "ok"), INTERVAL, TIMEOUT);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("resolves null when timeout is exhausted", async () => {
    const result = await retry(async () => null, INTERVAL, 3 * INTERVAL);
    expect(result).toBeNull();
  });

  test("rejects when the first attempt throws", async () => {
    // A throw is a permanent failure and must reject the returned promise,
    // not escape as an unhandled rejection while the promise hangs forever
    await expect(
      retry(
        async () => {
          throw new Error("permanent failure");
        },
        INTERVAL,
        TIMEOUT,
      ),
    ).rejects.toThrow("permanent failure");
  });

  test("rejects when a retry attempt throws and stops retrying", async () => {
    let attempts = 0;
    await expect(
      retry(
        async () => {
          attempts++;
          if (attempts === 1) return null; // temporary failure, retry
          throw new Error("permanent failure on retry");
        },
        INTERVAL,
        TIMEOUT,
      ),
    ).rejects.toThrow("permanent failure on retry");

    // The polling interval must be cleared after the rejection
    const attemptsAtRejection = attempts;
    await new Promise((r) => setTimeout(r, 5 * INTERVAL));
    expect(attempts).toBe(attemptsAtRejection);
  });
});
