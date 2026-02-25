import { createServer } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HttpClient, HttpStatusError } from "../../src/core/httpClient";

describe("HttpClient", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl = "";
  let flakyCount = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.url === "/flaky") {
        flakyCount += 1;
        if (flakyCount < 2) {
          res.statusCode = 503;
          res.end("try again");
          return;
        }
        res.end("recovered");
        return;
      }

      if (req.url === "/slow") {
        setTimeout(() => {
          res.end("slow");
        }, 40);
        return;
      }

      res.end("hello");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("fetches text", async () => {
    const client = new HttpClient({ timeoutMs: 500 });
    const response = await client.text(`${baseUrl}/`);
    expect(response.data).toBe("hello");
  });

  it("fetches json", async () => {
    const client = new HttpClient();
    const response = await client.json<{ ok: boolean }>(`${baseUrl}/json`);
    expect(response.data.ok).toBe(true);
  });

  it("retries retryable statuses", async () => {
    flakyCount = 0;
    const client = new HttpClient();
    const response = await client.text(`${baseUrl}/flaky`);
    expect(response.data).toBe("recovered");
    expect(flakyCount).toBe(2);
  });

  it("times out", async () => {
    const client = new HttpClient({ timeoutMs: 10 });
    await expect(client.text(`${baseUrl}/slow`)).rejects.toThrow();
  });

  it("throws status error for non-retryable responses", async () => {
    const failing = createServer((_req, res) => {
      res.statusCode = 404;
      res.end("nope");
    });

    await new Promise<void>((resolve) => failing.listen(0, "127.0.0.1", resolve));
    const address = failing.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind failing server");
    }

    const client = new HttpClient();
    await expect(
      client.text(`http://127.0.0.1:${address.port}/missing`, {
        retry: { retries: 0 },
      }),
    ).rejects.toBeInstanceOf(HttpStatusError);

    await new Promise<void>((resolve, reject) =>
      failing.close((err) => (err ? reject(err) : resolve())),
    );
  });
});

