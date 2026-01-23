import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRetryDelay,
  isRetryableError,
  isRetryableErrorMessage,
  calculateNextRetryState,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type SendAttemptResult,
} from './retry-service';

describe('retry-service', () => {
  describe('calculateRetryDelay', () => {
    it('should return base delay for first retry', () => {
      const delay = calculateRetryDelay(1);
      expect(delay).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
    });

    it('should apply exponential backoff for subsequent retries', () => {
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);
      const delay3 = calculateRetryDelay(3);

      expect(delay2).toBe(delay1 * DEFAULT_RETRY_CONFIG.backoffMultiplier);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should not exceed max delay', () => {
      const delay = calculateRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
    });

    it('should return 0 for retryCount of 0', () => {
      const delay = calculateRetryDelay(0);
      expect(delay).toBe(0);
    });

    it('should use custom config when provided', () => {
      const customConfig: RetryConfig = {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      };
      const delay = calculateRetryDelay(1, customConfig);
      expect(delay).toBe(1000);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 5xx server errors', () => {
      expect(isRetryableError(500)).toBe(true);
      expect(isRetryableError(502)).toBe(true);
      expect(isRetryableError(503)).toBe(true);
      expect(isRetryableError(504)).toBe(true);
    });

    it('should return true for 429 rate limit error', () => {
      expect(isRetryableError(429)).toBe(true);
    });

    it('should return false for 4xx client errors (except 429)', () => {
      expect(isRetryableError(400)).toBe(false);
      expect(isRetryableError(401)).toBe(false);
      expect(isRetryableError(403)).toBe(false);
      expect(isRetryableError(404)).toBe(false);
      expect(isRetryableError(422)).toBe(false);
    });

    it('should return false for 2xx success codes', () => {
      expect(isRetryableError(200)).toBe(false);
      expect(isRetryableError(201)).toBe(false);
      expect(isRetryableError(204)).toBe(false);
    });
  });

  describe('isRetryableErrorMessage', () => {
    it('should return true for timeout errors', () => {
      expect(isRetryableErrorMessage('Connection timeout')).toBe(true);
      expect(isRetryableErrorMessage('Request timed out')).toBe(true);
      expect(isRetryableErrorMessage('ETIMEDOUT')).toBe(true);
    });

    it('should return true for network errors', () => {
      expect(isRetryableErrorMessage('Network error')).toBe(true);
      expect(isRetryableErrorMessage('ECONNRESET')).toBe(true);
      expect(isRetryableErrorMessage('ECONNREFUSED')).toBe(true);
      expect(isRetryableErrorMessage('fetch failed')).toBe(true);
    });

    it('should return true for temporary unavailability', () => {
      expect(isRetryableErrorMessage('Service temporarily unavailable')).toBe(true);
      expect(isRetryableErrorMessage('temporarily unavailable')).toBe(true);
    });

    it('should return false for permanent errors', () => {
      expect(isRetryableErrorMessage('Invalid API key')).toBe(false);
      expect(isRetryableErrorMessage('Email address not found')).toBe(false);
      expect(isRetryableErrorMessage('Permission denied')).toBe(false);
    });
  });

  describe('calculateNextRetryState', () => {
    it('should not retry on success', () => {
      const result: SendAttemptResult = {
        success: true,
        messageId: 'msg-123',
      };

      const state = calculateNextRetryState(0, result);

      expect(state.shouldRetry).toBe(false);
      expect(state.retryCount).toBe(0);
      expect(state.lastError).toBeNull();
      expect(state.nextRetryAt).toBeNull();
    });

    it('should retry on retryable failure within max retries', () => {
      const result: SendAttemptResult = {
        success: false,
        error: 'Server error',
        retryable: true,
      };

      const state = calculateNextRetryState(0, result);

      expect(state.shouldRetry).toBe(true);
      expect(state.retryCount).toBe(1);
      expect(state.lastError).toBe('Server error');
      expect(state.nextRetryAt).not.toBeNull();
    });

    it('should not retry on non-retryable failure', () => {
      const result: SendAttemptResult = {
        success: false,
        error: 'Invalid email',
        retryable: false,
      };

      const state = calculateNextRetryState(0, result);

      expect(state.shouldRetry).toBe(false);
      expect(state.retryCount).toBe(1);
      expect(state.lastError).toBe('Invalid email');
    });

    it('should not retry when max retries exceeded', () => {
      const result: SendAttemptResult = {
        success: false,
        error: 'Server error',
        retryable: true,
      };

      const state = calculateNextRetryState(3, result);

      expect(state.shouldRetry).toBe(false);
      expect(state.retryCount).toBe(4);
      expect(state.lastError).toBe('Server error');
    });

    it('should calculate correct nextRetryAt time', () => {
      const result: SendAttemptResult = {
        success: false,
        error: 'Server error',
        retryable: true,
      };

      const before = Date.now();
      const state = calculateNextRetryState(1, result);
      const after = Date.now();

      const expectedDelay = calculateRetryDelay(2);
      const nextRetryTime = state.nextRetryAt!.getTime();

      expect(nextRetryTime).toBeGreaterThanOrEqual(before + expectedDelay);
      expect(nextRetryTime).toBeLessThanOrEqual(after + expectedDelay + 100);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const isRetryable = vi.fn().mockReturnValue(false);

      const result = await withRetry(fn, isRetryable);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(isRetryable).not.toHaveBeenCalled();
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValue('success');
      const isRetryable = vi.fn().mockReturnValue(true);

      const resultPromise = withRetry(fn, isRetryable);

      // Advance timer for retry delay
      await vi.advanceTimersByTimeAsync(DEFAULT_RETRY_CONFIG.baseDelayMs);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      const error = new Error('persistent error');
      const fn = vi.fn().mockRejectedValue(error);
      const isRetryable = vi.fn().mockReturnValue(true);

      const resultPromise = withRetry(fn, isRetryable);

      // Advance through all retries with runAllTimersAsync
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('persistent error');
      expect(fn).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('permanent error');
      const fn = vi.fn().mockRejectedValue(error);
      const isRetryable = vi.fn().mockReturnValue(false);

      await expect(withRetry(fn, isRetryable)).rejects.toThrow('permanent error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('temp'))
        .mockResolvedValue('success');
      const isRetryable = vi.fn().mockReturnValue(true);
      const onRetry = vi.fn();

      const resultPromise = withRetry(fn, isRetryable, DEFAULT_RETRY_CONFIG, onRetry);

      await vi.advanceTimersByTimeAsync(DEFAULT_RETRY_CONFIG.baseDelayMs);
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        DEFAULT_RETRY_CONFIG.baseDelayMs
      );
    });

    it('should use custom config', async () => {
      const customConfig: RetryConfig = {
        maxRetries: 1,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      };

      const error = new Error('error');
      const fn = vi.fn().mockRejectedValue(error);
      const isRetryable = vi.fn().mockReturnValue(true);

      const resultPromise = withRetry(fn, isRetryable, customConfig);

      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('error');
      expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });
  });
});
