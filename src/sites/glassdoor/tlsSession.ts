import type { IncomingHttpHeaders } from "node:http";

import { Session, destroyTLS, initTLS } from "node-tls-client";

import { HttpStatusError, type HttpRequestOptions, type HttpResponse } from "../../core/httpClient";
import { withRetry, type RetryOptions } from "../../core/retry";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

let tlsRuntimeRefCount = 0;
let tlsRuntimeQueue: Promise<void> = Promise.resolve();

export interface GlassdoorTlsSessionOptions {
  timeoutMs?: number;
  proxyUrl?: string;
}

export class GlassdoorTlsSession {
  private closed = false;

  private constructor(private readonly session: Session) {}

  public static async create(
    options: GlassdoorTlsSessionOptions = {},
  ): Promise<GlassdoorTlsSession> {
    await queueTlsRuntimeOp(async () => {
      if (tlsRuntimeRefCount === 0) {
        await initTLS();
      }
      tlsRuntimeRefCount += 1;
    });

    try {
      const session = new Session({
        randomTlsExtensionOrder: true,
        timeout: options.timeoutMs,
        proxy: options.proxyUrl,
      });
      return new GlassdoorTlsSession(session);
    } catch (error) {
      await releaseTlsRuntimeRef();
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    let closeError: unknown;
    try {
      await this.session.close();
    } catch (error) {
      closeError = error;
    }

    try {
      await releaseTlsRuntimeRef();
    } catch (error) {
      if (!closeError) {
        closeError = error;
      }
    }

    if (closeError) {
      throw closeError instanceof Error ? closeError : new Error(String(closeError));
    }
  }

  public async text(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<string>> {
    const retryOptions = this.toRetryOptions(options.retry);
    return withRetry(
      async () => this.executeTextRequest(url, options),
      retryOptions,
    );
  }

  public async json<T>(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const res = await this.text(url, options);
    return {
      ...res,
      data: JSON.parse(res.data) as T,
    };
  }

  private async executeTextRequest(
    url: string,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<string>> {
    const method = (options.method ?? "GET").toUpperCase();
    const requestOptions = {
      headers: options.headers,
      body:
        options.body instanceof Uint8Array
          ? Buffer.from(options.body)
          : options.body,
      followRedirects: true,
      proxy: options.proxyUrl,
    };

    const response =
      method === "POST"
        ? await this.session.post(url, requestOptions)
        : method === "GET"
          ? await this.session.get(url, requestOptions)
          : method === "PUT"
            ? await this.session.put(url, requestOptions)
            : method === "PATCH"
              ? await this.session.patch(url, requestOptions)
              : method === "DELETE"
                ? await this.session.delete(url, requestOptions)
                : method === "HEAD"
                  ? await this.session.head(url, requestOptions)
                  : method === "OPTIONS"
                    ? await this.session.options(url, requestOptions)
                    : await this.session.get(url, requestOptions);

    const text = await response.text();
    if (!response.ok) {
      throw new HttpStatusError(response.status, text, `HTTP ${response.status} for ${url}`);
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: toHeaders(response.headers),
      url: response.url || url,
      data: text,
    };
  }

  private toRetryOptions(partial?: Partial<RetryOptions>): RetryOptions {
    return {
      retries: partial?.retries ?? 2,
      minDelayMs: partial?.minDelayMs ?? 250,
      maxDelayMs: partial?.maxDelayMs ?? 2_000,
      factor: partial?.factor ?? 2,
      jitter: partial?.jitter ?? true,
      shouldRetry: partial?.shouldRetry ?? ((error) => this.shouldRetryError(error)),
    };
  }

  private shouldRetryError(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
      return RETRYABLE_STATUSES.has(error.status);
    }

    if (error instanceof Error) {
      return (
        error.name === "AbortError" ||
        /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|timeout/i.test(error.message)
      );
    }

    return false;
  }
}

function toHeaders(headers: IncomingHttpHeaders | undefined): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (Array.isArray(value)) {
      result.set(key, value.join(", "));
      continue;
    }
    if (value == null) {
      continue;
    }
    result.set(key, String(value));
  }
  return result;
}

function queueTlsRuntimeOp<T>(op: () => Promise<T>): Promise<T> {
  const run = tlsRuntimeQueue.then(op, op);
  tlsRuntimeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function releaseTlsRuntimeRef(): Promise<void> {
  await queueTlsRuntimeOp(async () => {
    if (tlsRuntimeRefCount <= 0) {
      tlsRuntimeRefCount = 0;
      return;
    }

    tlsRuntimeRefCount -= 1;
    if (tlsRuntimeRefCount === 0) {
      await destroyTLS();
    }
  });
}
