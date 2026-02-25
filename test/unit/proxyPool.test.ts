import { describe, expect, it } from "vitest";

import { ProxyPool } from "../../src/core/proxyPool";

describe("ProxyPool", () => {
  it("normalizes proxies and rotates", () => {
    const pool = new ProxyPool(["127.0.0.1:8080", "https://proxy.example:443"]);

    expect(pool.hasProxies()).toBe(true);
    expect(pool.size()).toBe(2);
    expect(pool.next().proxyUrl).toBe("http://127.0.0.1:8080");
    expect(pool.next().proxyUrl).toBe("https://proxy.example:443");
    expect(pool.next().proxyUrl).toBe("http://127.0.0.1:8080");
  });

  it("returns empty selection when no proxies exist", () => {
    const pool = new ProxyPool();
    expect(pool.next()).toEqual({ index: -1, proxyUrl: undefined });
  });
});

