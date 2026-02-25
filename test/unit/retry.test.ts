import { describe, expect, it, vi } from "vitest";

import { withRetry } from "../../src/core/retry";

describe("withRetry", () => {
  it("retries and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("temporary");
        }
        return "ok";
      },
      { retries: 4, minDelayMs: 0, maxDelayMs: 0, jitter: false },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("respects shouldRetry false", async () => {
    const fn = vi.fn(async () => {
      throw new Error("stop");
    });

    await expect(
      withRetry(fn, {
        retries: 3,
        minDelayMs: 0,
        maxDelayMs: 0,
        jitter: false,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("stop");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

