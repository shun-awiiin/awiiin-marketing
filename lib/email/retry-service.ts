/**
 * Email Retry Service
 * Handles retry logic for failed email sends with exponential backoff
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryState {
  retryCount: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  shouldRetry: boolean;
}

export interface SendAttemptResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 30000,      // 30 seconds
  maxDelayMs: 600000,      // 10 minutes
  backoffMultiplier: 4,    // 30s -> 2m -> 8m (capped at 10m)
};

// Patterns indicating retryable errors
const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /etimedout/i,
  /network/i,
  /econnreset/i,
  /econnrefused/i,
  /fetch failed/i,
  /temporarily unavailable/i,
  /service unavailable/i,
];

/**
 * Calculate the delay before the next retry attempt using exponential backoff
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  if (retryCount <= 0) {
    return 0;
  }

  // Exponential backoff: baseDelay * multiplier^(retryCount - 1)
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount - 1);

  // Cap at maxDelay
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determine if an error is retryable based on HTTP status code
 */
export function isRetryableError(statusCode: number): boolean {
  // 5xx server errors are retryable
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // 429 Too Many Requests is retryable
  if (statusCode === 429) {
    return true;
  }

  return false;
}

/**
 * Determine if an error message indicates a retryable condition
 */
export function isRetryableErrorMessage(errorMessage: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

/**
 * Calculate the next retry state based on the current attempt result
 */
export function calculateNextRetryState(
  currentRetryCount: number,
  attemptResult: SendAttemptResult,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): RetryState {
  // Success - no retry needed
  if (attemptResult.success) {
    return {
      retryCount: currentRetryCount,
      lastError: null,
      nextRetryAt: null,
      shouldRetry: false,
    };
  }

  const newRetryCount = currentRetryCount + 1;
  const lastError = attemptResult.error || null;

  // Check if we should retry
  const isRetryable = attemptResult.retryable === true;
  const withinMaxRetries = newRetryCount <= config.maxRetries;
  const shouldRetry = isRetryable && withinMaxRetries;

  // Calculate next retry time if we should retry
  let nextRetryAt: Date | null = null;
  if (shouldRetry) {
    const delay = calculateRetryDelay(newRetryCount, config);
    nextRetryAt = new Date(Date.now() + delay);
  }

  return {
    retryCount: newRetryCount,
    lastError,
    nextRetryAt,
    shouldRetry,
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (retryCount: number, error: unknown, delayMs: number) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const canRetry = isRetryable(error);
      const hasRetriesLeft = attempt < config.maxRetries;

      if (!canRetry || !hasRetriesLeft) {
        throw error;
      }

      // Calculate delay for this retry
      const retryCount = attempt + 1;
      const delay = calculateRetryDelay(retryCount, config);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(retryCount, error, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should not reach here, but throw last error just in case
  throw lastError;
}
