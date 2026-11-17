import { describe, expect, jest, test } from "@jest/globals";
import { AutomaticPorticoRoute } from "./../src/routes/portico/automatic.js";

describe("AutomaticPorticoRoute.initiate", () => {
  const sentinel = new Error("quote accepted");
  const getPorticoBridge = jest.fn(async () => {
    throw sentinel;
  });
  const request: any = {
    fromChain: { getPorticoBridge },
    toChain: {},
    source: { id: {} },
    destination: { id: {} },
  };
  const route = new AutomaticPorticoRoute({} as any);
  const initiate = (expires?: Date) =>
    route.initiate(request, {} as any, { expires, params: {}, details: {} } as any, {} as any);

  beforeEach(() => getPorticoBridge.mockClear());

  test("rejects an expired quote before building the transfer", async () => {
    await expect(initiate(new Date(Date.now() - 1000))).rejects.toThrow(
      "Quote has expired, please request a new quote",
    );
    expect(getPorticoBridge).not.toHaveBeenCalled();
  });

  test("does not reject a quote that has not expired", async () => {
    await expect(initiate(new Date(Date.now() + 60_000))).rejects.toBe(sentinel);
    expect(getPorticoBridge).toHaveBeenCalledTimes(1);
  });
});
