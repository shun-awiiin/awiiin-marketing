/**
 * Test Send Service - Tests
 * TDD: RED phase - Write tests first
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateTestSendRequest,
  checkTestSendRateLimit,
  generateTestEmailPreview,
  sendTestEmail,
  TestSendError,
} from './test-send-service';
import type { Campaign, Template, TemplateType } from '@/lib/types/database';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabaseClient),
}));

// Mock email sender
vi.mock('./email-sender', () => ({
  sendEmail: vi.fn(),
}));

describe('Test Send Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateTestSendRequest', () => {
    it('should accept valid email address', () => {
      const result = validateTestSendRequest({
        recipient_email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipient_email).toBe('test@example.com');
      }
    });

    it('should reject invalid email address', () => {
      const result = validateTestSendRequest({
        recipient_email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should set default include_preview to true', () => {
      const result = validateTestSendRequest({
        recipient_email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.include_preview).toBe(true);
      }
    });

    it('should accept optional sample_first_name', () => {
      const result = validateTestSendRequest({
        recipient_email: 'test@example.com',
        sample_first_name: '田中',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sample_first_name).toBe('田中');
      }
    });
  });

  describe('checkTestSendRateLimit', () => {
    it('should allow test send when under rate limit', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        count: 3, // 3 sends in the last hour, under limit of 5
      });

      const result = await checkTestSendRateLimit('campaign-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should deny test send when rate limit reached', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        count: 5, // Already at limit
      });

      const result = await checkTestSendRateLimit('campaign-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow first test send', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        count: 0,
      });

      const result = await checkTestSendRateLimit('campaign-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });

  describe('generateTestEmailPreview', () => {
    const mockCampaign: Partial<Campaign> = {
      id: 'campaign-1',
      type: 'SEMINAR_INVITE' as TemplateType,
      input_payload: {
        event_name: 'AI活用セミナー',
        event_date: '2024年2月1日',
        event_location: '東京',
        url: 'https://example.com/seminar',
      },
      from_name: '営業部',
      from_email: 'sales@example.com',
    };

    const mockTemplate: Partial<Template> = {
      subject_variants: [
        '{{firstName}}さん、1点だけ共有です',
        '{{firstName}}さん向けにご連絡です',
      ],
      body_text: `{{firstName}}さん

{{event_name}}のご案内です。
日時: {{event_date}}
場所: {{event_location}}

詳細はこちら: {{url}}`,
    };

    it('should generate preview with default firstName when not provided', () => {
      const preview = generateTestEmailPreview(
        mockCampaign as Campaign,
        mockTemplate as Template,
        0
      );

      expect(preview.subject).toContain('[TEST]');
      expect(preview.subject).toContain('ご担当者さま');
      expect(preview.body_text).toContain('AI活用セミナー');
      expect(preview.from).toBe('営業部 <sales@example.com>');
    });

    it('should generate preview with custom firstName', () => {
      const preview = generateTestEmailPreview(
        mockCampaign as Campaign,
        mockTemplate as Template,
        0,
        '佐藤'
      );

      expect(preview.subject).toContain('佐藤');
      expect(preview.body_text).toContain('佐藤');
    });

    it('should use correct subject variant based on index', () => {
      const preview1 = generateTestEmailPreview(
        mockCampaign as Campaign,
        mockTemplate as Template,
        0,
        'テスト'
      );

      const preview2 = generateTestEmailPreview(
        mockCampaign as Campaign,
        mockTemplate as Template,
        1,
        'テスト'
      );

      expect(preview1.subject).not.toBe(preview2.subject);
    });

    it('should add [TEST] prefix to subject', () => {
      const preview = generateTestEmailPreview(
        mockCampaign as Campaign,
        mockTemplate as Template,
        0
      );

      expect(preview.subject).toContain('[TEST]');
    });
  });

  describe('sendTestEmail', () => {
    const mockCampaign: Partial<Campaign> = {
      id: 'campaign-1',
      type: 'SEMINAR_INVITE' as TemplateType,
      input_payload: {
        event_name: 'AI活用セミナー',
        event_date: '2024年2月1日',
        event_location: '東京',
        url: 'https://example.com/seminar',
      },
      from_name: '営業部',
      from_email: 'sales@example.com',
    };

    const mockTemplate: Partial<Template> = {
      subject_variants: ['{{firstName}}さん、1点だけ共有です'],
      body_text: '{{firstName}}さん\nテストメール本文',
    };

    it('should send test email successfully', async () => {
      // Mock rate limit check - under limit
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();

      const { sendEmail } = await import('./email-sender');
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        messageId: 'test-msg-123',
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const result = await sendTestEmail(
        mockCampaign as Campaign,
        mockTemplate as Template,
        {
          recipient_email: 'recipient@example.com',
          include_preview: true,
        },
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.message_id).toBe('test-msg-123');
      expect(result.preview).toBeDefined();
    });

    it('should throw error when rate limit exceeded', async () => {
      // Mock rate limit exceeded
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockResolvedValueOnce({
        data: null,
        count: 5,
      });

      await expect(
        sendTestEmail(
          mockCampaign as Campaign,
          mockTemplate as Template,
          {
            recipient_email: 'recipient@example.com',
          },
          'user-1'
        )
      ).rejects.toThrow(TestSendError);
    });

    it('should log test send to database', async () => {
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockResolvedValueOnce({
        data: null,
        count: 0,
      });

      const { sendEmail } = await import('./email-sender');
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        messageId: 'test-msg-456',
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      await sendTestEmail(
        mockCampaign as Campaign,
        mockTemplate as Template,
        { recipient_email: 'test@example.com' },
        'user-1'
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_sends');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });
  });

  describe('TestSendError', () => {
    it('should have correct error code', () => {
      const error = new TestSendError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('Rate limit exceeded');
    });
  });
});
