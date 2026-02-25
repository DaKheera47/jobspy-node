export interface RetryOptions {
  retries: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const retries = Math.max(0, options.retries);
  const factor = options.factor ?? 2;
  const minDelayMs = options.minDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const jitter = options.jitter ?? true;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        break;
      }

      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        break;
      }

      const exponentialDelay = Math.min(
        maxDelayMs,
        minDelayMs * factor ** attempt,
      );
      const waitMs = jitter
        ? Math.round(exponentialDelay * (0.75 + Math.random() * 0.5))
        : exponentialDelay;

      await sleep(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

