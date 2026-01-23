/**
 * Webhook Security - Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifySendGridSignature,
  verifyResendSignature,
  checkEventIdempotency,
  generateIdempotencyKey,
} from './webhook-security';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => Promise.resolve(mockSupabaseClient),
}));

describe('Webhook Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('verifySendGridSignature', () => {
    it('should return true in development when no key configured', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SENDGRID_WEBHOOK_VERIFICATION_KEY', '');

      const result = verifySendGridSignature('payload', null, null);
      expect(result).toBe(true);
    });

    it('should return false when signature is missing', () => {
      vi.stubEnv('SENDGRID_WEBHOOK_VERIFICATION_KEY', 'test-key');

      const result = verifySendGridSignature('payload', null, '1234567890');
      expect(result).toBe(false);
    });

    it('should return false when timestamp is missing', () => {
      vi.stubEnv('SENDGRID_WEBHOOK_VERIFICATION_KEY', 'test-key');

      const result = verifySendGridSignature('payload', 'signature', null);
      expect(result).toBe(false);
    });
  });

  describe('verifyResendSignature', () => {
    it('should return true in development when no secret configured', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

      const result = verifyResendSignature('payload', null);
      expect(result).toBe(true);
    });

    it('should return false when signature is missing', () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'test-secret');

      const result = verifyResendSignature('payload', null);
      expect(result).toBe(false);
    });
  });

  describe('checkEventIdempotency', () => {
    it('should return isDuplicate true when event exists', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'existing-event-id' },
        error: null,
      });

      const result = await checkEventIdempotency('ses', 'message-123', 'bounce');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('existing-event-id');
    });

    it('should return isDuplicate false when event does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      });

      const result = await checkEventIdempotency('ses', 'message-456', 'delivery');

      expect(result.isDuplicate).toBe(false);
      expect(result.existingId).toBeUndefined();
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate correct key format', () => {
      const key = generateIdempotencyKey('ses', 'msg-123', 'bounce');
      expect(key).toBe('ses:msg-123:bounce');
    });

    it('should handle different providers', () => {
      const sesKey = generateIdempotencyKey('ses', 'msg-1', 'delivery');
      const sgKey = generateIdempotencyKey('sendgrid', 'msg-2', 'open');
      const resendKey = generateIdempotencyKey('resend', 'msg-3', 'click');

      expect(sesKey).toBe('ses:msg-1:delivery');
      expect(sgKey).toBe('sendgrid:msg-2:open');
      expect(resendKey).toBe('resend:msg-3:click');
    });
  });
});
