/**
 * Template Renderer - Tests
 * Comprehensive test coverage for email template rendering
 */
import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  generateSubject,
  buildContext,
  generateEmailBody,
  validateContext,
  previewEmail,
  sanitizeUrl,
  isValidEmail,
  generateUnsubscribeToken,
} from './template-renderer';
import type {
  SeminarInvitePayload,
  FreeTrialInvitePayload,
  TemplateType,
} from '@/lib/types/database';

describe('Template Renderer', () => {
  describe('renderTemplate', () => {
    it('should replace {{firstName}} with provided name', () => {
      const template = 'Hello {{firstName}}!';
      const result = renderTemplate(template, { firstName: 'John' });
      expect(result).toBe('Hello John!');
    });

    it('should use default name when firstName is not provided', () => {
      const template = 'Hello {{firstName}}!';
      const result = renderTemplate(template, {});
      expect(result).toBe('Hello ご担当者さま!');
    });

    it('should use default name when firstName is null', () => {
      const template = 'Hello {{firstName}}!';
      const result = renderTemplate(template, { firstName: null });
      expect(result).toBe('Hello ご担当者さま!');
    });

    it('should replace multiple variables', () => {
      const template = '{{firstName}}さん、{{event_name}}にご招待します。場所: {{event_location}}';
      const result = renderTemplate(template, {
        firstName: '田中',
        event_name: 'AI セミナー',
        event_location: '東京',
      });
      expect(result).toBe('田中さん、AI セミナーにご招待します。場所: 東京');
    });

    it('should handle extra_bullets section with content', () => {
      const template = `メインコンテンツ
{{#extra_bullets}}
- バレットポイント
{{/extra_bullets}}
終わり`;
      const result = renderTemplate(template, {
        extra_bullets: ['ポイント1', 'ポイント2'],
      });
      expect(result).toContain('ポイント1');
      expect(result).toContain('ポイント2');
    });

    it('should remove extra_bullets section when empty', () => {
      const template = `メインコンテンツ
{{#extra_bullets}}
- バレットポイント
{{/extra_bullets}}
終わり`;
      const result = renderTemplate(template, {});
      expect(result).not.toContain('バレットポイント');
      expect(result).toContain('メインコンテンツ');
      expect(result).toContain('終わり');
    });

    it('should clean up excessive newlines', () => {
      const template = 'Line1\n\n\n\n\nLine2';
      const result = renderTemplate(template, {});
      expect(result).toBe('Line1\n\nLine2');
    });

    it('should trim the result', () => {
      const template = '  Hello  ';
      const result = renderTemplate(template, {});
      expect(result).toBe('Hello');
    });
  });

  describe('generateSubject', () => {
    it('should generate subject for SEMINAR_INVITE type', () => {
      const subject = generateSubject('SEMINAR_INVITE', 0, '山田');
      expect(subject).toBe('山田さん、1点だけ共有です');
    });

    it('should generate subject for FREE_TRIAL_INVITE type', () => {
      const subject = generateSubject('FREE_TRIAL_INVITE', 0, '鈴木');
      expect(subject).toBe('鈴木さん、先日の件で1点だけ');
    });

    it('should use different variant based on index', () => {
      const subject0 = generateSubject('SEMINAR_INVITE', 0, 'テスト');
      const subject1 = generateSubject('SEMINAR_INVITE', 1, 'テスト');
      const subject2 = generateSubject('SEMINAR_INVITE', 2, 'テスト');

      expect(subject0).not.toBe(subject1);
      expect(subject1).not.toBe(subject2);
    });

    it('should fallback to first variant for invalid index', () => {
      const subject = generateSubject('SEMINAR_INVITE', 99, 'テスト');
      expect(subject).toBe('テストさん、1点だけ共有です');
    });

    it('should use default name when firstName not provided', () => {
      const subject = generateSubject('SEMINAR_INVITE', 0);
      expect(subject).toContain('ご担当者さま');
    });
  });

  describe('buildContext', () => {
    it('should build context for SEMINAR_INVITE', () => {
      const payload: SeminarInvitePayload = {
        event_name: 'AI活用セミナー',
        event_date: '2024年2月1日',
        event_location: '東京都渋谷区',
        url: 'https://example.com/event',
        extra_bullets: ['特典1', '特典2'],
      };

      const context = buildContext('SEMINAR_INVITE', payload, '田中');

      expect(context.firstName).toBe('田中');
      expect(context.event_name).toBe('AI活用セミナー');
      expect(context.event_date).toBe('2024年2月1日');
      expect(context.event_location).toBe('東京都渋谷区');
      expect(context.url).toBe('https://example.com/event');
      expect(context.extra_bullets).toEqual(['特典1', '特典2']);
    });

    it('should build context for FREE_TRIAL_INVITE', () => {
      const payload: FreeTrialInvitePayload = {
        tool_name: 'AIツール',
        one_liner: '業務効率を10倍に',
        url: 'https://example.com/trial',
      };

      const context = buildContext('FREE_TRIAL_INVITE', payload, '佐藤');

      expect(context.firstName).toBe('佐藤');
      expect(context.tool_name).toBe('AIツール');
      expect(context.one_liner).toBe('業務効率を10倍に');
      expect(context.url).toBe('https://example.com/trial');
    });

    it('should handle null firstName', () => {
      const payload: SeminarInvitePayload = {
        event_name: 'Test',
        event_date: '2024-01-01',
        event_location: 'Tokyo',
        url: 'https://example.com',
      };

      const context = buildContext('SEMINAR_INVITE', payload, null);
      expect(context.firstName).toBeNull();
    });
  });

  describe('generateEmailBody', () => {
    it('should render body with context and add unsubscribe link', () => {
      const template = '{{firstName}}さん、こんにちは';
      const context = { firstName: '山田' };
      const unsubscribeUrl = 'https://example.com/unsubscribe/abc123';

      const body = generateEmailBody(template, context, unsubscribeUrl);

      expect(body).toContain('山田さん、こんにちは');
      expect(body).toContain('配信停止はこちら:');
      expect(body).toContain(unsubscribeUrl);
    });
  });

  describe('validateContext', () => {
    it('should validate SEMINAR_INVITE with all required fields', () => {
      const context = {
        event_name: 'Test Event',
        event_date: '2024-01-01',
        event_location: 'Tokyo',
        url: 'https://example.com',
      };

      const result = validateContext('SEMINAR_INVITE', context);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should detect missing fields for SEMINAR_INVITE', () => {
      const context = {
        event_name: 'Test Event',
        // missing: event_date, event_location, url
      };

      const result = validateContext('SEMINAR_INVITE', context);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('event_date');
      expect(result.missingFields).toContain('event_location');
      expect(result.missingFields).toContain('url');
    });

    it('should validate FREE_TRIAL_INVITE with all required fields', () => {
      const context = {
        tool_name: 'AI Tool',
        one_liner: 'Best tool ever',
        url: 'https://example.com',
      };

      const result = validateContext('FREE_TRIAL_INVITE', context);
      expect(result.valid).toBe(true);
    });

    it('should detect missing fields for FREE_TRIAL_INVITE', () => {
      const context = {
        tool_name: 'AI Tool',
        // missing: one_liner, url
      };

      const result = validateContext('FREE_TRIAL_INVITE', context);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('one_liner');
      expect(result.missingFields).toContain('url');
    });
  });

  describe('previewEmail', () => {
    it('should generate email preview', () => {
      const template = '{{firstName}}さん、{{event_name}}のご案内です。詳細: {{url}}';
      const payload: SeminarInvitePayload = {
        event_name: 'セミナー',
        event_date: '2024年1月',
        event_location: '東京',
        url: 'https://example.com',
      };

      const preview = previewEmail(
        template,
        'SEMINAR_INVITE',
        payload,
        0,
        '営業部',
        'sales@example.com',
        { email: 'user@example.com', first_name: '田中' }
      );

      expect(preview.subject).toContain('田中');
      expect(preview.body).toContain('田中さん');
      expect(preview.body).toContain('セミナー');
      expect(preview.from).toBe('営業部 <sales@example.com>');
      expect(preview.to).toBe('user@example.com');
    });

    it('should use placeholder unsubscribe link in preview', () => {
      const template = 'Content';
      const payload: SeminarInvitePayload = {
        event_name: 'Event',
        event_date: '2024-01-01',
        event_location: 'Place',
        url: 'https://example.com',
      };

      const preview = previewEmail(
        template,
        'SEMINAR_INVITE',
        payload,
        0,
        'Name',
        'email@example.com',
        { email: 'to@example.com' }
      );

      expect(preview.body).toContain('[配信停止リンク]');
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid HTTPS URL as-is', () => {
      const url = 'https://example.com/path';
      expect(sanitizeUrl(url)).toBe('https://example.com/path');
    });

    it('should upgrade HTTP to HTTPS', () => {
      const url = 'http://example.com/path';
      expect(sanitizeUrl(url)).toBe('https://example.com/path');
    });

    it('should throw error for invalid URL', () => {
      expect(() => sanitizeUrl('not-a-url')).toThrow('Invalid URL format');
    });

    it('should preserve query parameters', () => {
      const url = 'http://example.com/path?param=value';
      expect(sanitizeUrl(url)).toBe('https://example.com/path?param=value');
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.jp')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('generateUnsubscribeToken', () => {
    it('should generate a token', () => {
      const token = generateUnsubscribeToken('test@example.com', 'campaign-123');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
    });

    it('should generate unique tokens for different emails', () => {
      const token1 = generateUnsubscribeToken('user1@example.com', 'campaign-123');
      const token2 = generateUnsubscribeToken('user2@example.com', 'campaign-123');
      expect(token1).not.toBe(token2);
    });

    it('should generate unique tokens for different campaigns', () => {
      const token1 = generateUnsubscribeToken('test@example.com', 'campaign-1');
      const token2 = generateUnsubscribeToken('test@example.com', 'campaign-2');
      expect(token1).not.toBe(token2);
    });
  });
});
