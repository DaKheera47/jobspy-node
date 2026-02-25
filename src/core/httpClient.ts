import { Agent, fetch, ProxyAgent, type Dispatcher, type RequestInit } from "undici";

import { withRetry, type RetryOptions } from "./retry";

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs?: number;
  retry?: Partial<RetryOptions>;
  proxyUrl?: string;
  caCert?: string;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
}

export interface HttpResponse<T = string> {
  status: number;
  ok: boolean;
  headers: Headers;
  url: string;
  data: T;
}

export interface HttpClientOptions {
  userAgent?: string;
  timeoutMs?: number;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class HttpStatusError extends Error {
  public readonly status: number;
  public readonly responseText: string;

  public constructor(status: number, responseText: string, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
    this.responseText = responseText;
  }
}

export class HttpClient {
  private readonly userAgent: string | undefined;
  private readonly timeoutMs: number;

  public constructor(options: HttpClientOptions = {}) {
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  public async text(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<string>> {
    const retryOptions: RetryOptions = {
      retries: options.retry?.retries ?? 2,
      minDelayMs: options.retry?.minDelayMs ?? 250,
      maxDelayMs: options.retry?.maxDelayMs ?? 2_000,
      factor: options.retry?.factor ?? 2,
      jitter: options.retry?.jitter ?? true,
      shouldRetry: (error) => this.shouldRetryError(error),
    };

    return withRetry(async () => {
      const timeoutMs = options.timeoutMs ?? this.timeoutMs;
      const timeoutController = new AbortController();
      const cleanup = this.forwardAbort(options.signal, timeoutController);
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      try {
        const requestInit: RequestInit = {
          method: options.method ?? "GET",
          signal: timeoutController.signal,
        };

        const headers = this.withUserAgent(options.headers);
        if (headers) {
          requestInit.headers = headers;
        }

        if (options.body) {
          requestInit.body = options.body;
        }

        const dispatcher =
          options.dispatcher ??
          this.createDispatcher(options.proxyUrl, options.caCert);
        if (dispatcher) {
          requestInit.dispatcher = dispatcher;
        }

        const res = await fetch(url, requestInit);

        const text = await res.text();
        if (!res.ok) {
          throw new HttpStatusError(res.status, text, `HTTP ${res.status} for ${url}`);
        }

        return {
          status: res.status,
          ok: res.ok,
          headers: res.headers,
          url: res.url,
          data: text,
        };
      } finally {
        clearTimeout(timeoutId);
        cleanup();
      }
    }, retryOptions);
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

  private withUserAgent(
    headers?: Record<string, string>,
  ): Record<string, string> | undefined {
    if (!this.userAgent) {
      return headers;
    }

    return {
      "user-agent": this.userAgent,
      ...headers,
    };
  }

  private shouldRetryError(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
      return RETRYABLE_STATUSES.has(error.status);
    }

    if (error instanceof Error) {
      return (
        error.name === "AbortError" ||
        /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(error.message)
      );
    }

    return false;
  }

  private createDispatcher(
    proxyUrl?: string,
    caCert?: string,
  ): Dispatcher | undefined {
    if (proxyUrl) {
      return new ProxyAgent(proxyUrl);
    }

    if (caCert) {
      return new Agent({
        connect: {
          ca: caCert,
        },
      });
    }

    return undefined;
  }

  private forwardAbort(
    sourceSignal: AbortSignal | undefined,
    targetController: AbortController,
  ): () => void {
    if (!sourceSignal) {
      return () => undefined;
    }

    if (sourceSignal.aborted) {
      targetController.abort();
      return () => undefined;
    }

    const onAbort = () => targetController.abort();
    sourceSignal.addEventListener("abort", onAbort, { once: true });
    return () => sourceSignal.removeEventListener("abort", onAbort);
  }
}
