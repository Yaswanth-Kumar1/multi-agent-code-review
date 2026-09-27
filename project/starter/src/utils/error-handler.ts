/**
 * Error handling utilities for the code review system.
 */

export class ReviewError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export const ErrorCodes = {
  MCP_CONNECTION: 'MCP_CONNECTION',
  MCP_TOOL: 'MCP_TOOL',
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_ERROR: 'AGENT_ERROR',
  VALIDATION: 'VALIDATION',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTHENTICATION: 'AUTHENTICATION',
  CONFIGURATION: 'CONFIGURATION',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Executes an async operation with exponential-backoff retries and jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt > maxRetries) {
        break;
      }

      const exponentialDelay = delayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      const totalDelay = exponentialDelay + jitter;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, totalDelay);
      });
    }
  }

  throw new ReviewError(
    `Operation failed after ${maxRetries} retries.`,
    ErrorCodes.RETRY_EXHAUSTED,
    {
      maxRetries,
      cause: lastError instanceof Error
        ? lastError.message
        : String(lastError),
    }
  );
}

/**
 * Rejects if an async operation does not complete within the timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new ReviewError(
          `Operation timed out after ${timeoutMs}ms.`,
          ErrorCodes.AGENT_TIMEOUT,
          { timeoutMs }
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}