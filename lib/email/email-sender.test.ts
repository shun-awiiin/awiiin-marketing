/**
 * Email Sender - Tests
 * Test coverage for email sending functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, getProvider } from './email-sender';

// Mock fetch globally
global.fetch = vi.fn();

describe('Email Sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    vi.stubEnv('EMAIL_PROVIDER', 'mock');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SENDGRID_API_KEY', '');
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getProvider', () => {
    it('should return mock when EMAIL_PROVIDER not set', () => {
      vi.stubEnv('EMAIL_PROVIDER', '');
      expect(getProvider()).toBe('mock');
    });

    it('should return ses when EMAIL_PROVIDER is ses', () => {
      vi.stubEnv('EMAIL_PROVIDER', 'ses');
      expect(getProvider()).toBe('ses');
    });

    it('should return resend when EMAIL_PROVIDER is resend', () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      expect(getProvider()).toBe('resend');
    });

    it('should return sendgrid when EMAIL_PROVIDER is sendgrid', () => {
      vi.stubEnv('EMAIL_PROVIDER', 'sendgrid');
      expect(getProvider()).toBe('sendgrid');
    });

    it('should return mock for unknown provider', () => {
      vi.stubEnv('EMAIL_PROVIDER', 'unknown');
      expect(getProvider()).toBe('mock');
    });
  });

  describe('sendEmail with mock provider', () => {
    it('should return success with mock message ID', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'mock');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^mock-/);
    });
  });

  describe('sendEmail with Resend', () => {
    it('should send email successfully via Resend', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', 'test-api-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'resend-msg-123' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-msg-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle Resend API error', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', 'test-api-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid email' }),
      });

      const result = await sendEmail({
        to: 'invalid',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
      expect(result.retryable).toBe(false);
    });

    it('should mark 5xx errors as retryable', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', 'test-api-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should mark 429 rate limit as retryable', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', 'test-api-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ message: 'Rate limit exceeded' }),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should return error when Resend API key not configured', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', '');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resend API key not configured');
      expect(result.retryable).toBe(false);
    });
  });

  describe('sendEmail with SendGrid', () => {
    it('should send email successfully via SendGrid', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'sendgrid');
      vi.stubEnv('SENDGRID_API_KEY', 'test-sg-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-Message-Id', 'sg-msg-456']]),
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return error when SendGrid API key not configured', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'sendgrid');
      vi.stubEnv('SENDGRID_API_KEY', '');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid API key not configured');
    });
  });

  describe('sendEmail with SES', () => {
    it('should return error when AWS credentials not configured', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'ses');
      vi.stubEnv('AWS_ACCESS_KEY_ID', '');
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('AWS credentials not configured');
      expect(result.retryable).toBe(false);
    });
  });

  describe('sendEmail error handling', () => {
    it('should handle network errors', async () => {
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('RESEND_API_KEY', 'test-api-key');

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        fromName: 'Sender',
        fromEmail: 'sender@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.retryable).toBe(true);
    });
  });
});
