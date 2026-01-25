import { describe, it, expect } from 'vitest'
import {
  generateYouTubePostText,
  parseDateTimeFromEventDate,
  YOUTUBE_STUDIO_URL,
  YOUTUBE_POST_LIMITS,
} from './youtube-post-generator'

describe('youtube-post-generator', () => {
  describe('generateYouTubePostText - SEMINAR_INVITE', () => {
    const seminarPayload = {
      event_name: 'eBay出品効率化セミナー',
      event_date: '2026年2月15日（土）14:00〜15:30',
      event_location: 'Zoomオンライン',
      url: 'https://example.com/seminar',
    }

    it('should generate correct text for seminar invite with default params', () => {
      const result = generateYouTubePostText('SEMINAR_INVITE', seminarPayload)

      expect(result).toContain('【30分だけ】eBay出品効率化セミナーを共有します')
      expect(result).toContain('2026年2月15日')
      expect(result).toContain('14:00')
      expect(result).toContain('https://example.com/seminar')
      expect(result).toContain('#eBay #物販 #副業')
      expect(result).toContain('「参加」か「アーカイブ希望」')
    })

    it('should use custom duration_minutes when provided', () => {
      const result = generateYouTubePostText('SEMINAR_INVITE', seminarPayload, {
        duration_minutes: 60,
      })

      expect(result).toContain('（60分）')
    })

    it('should use custom target_audience when provided', () => {
      const result = generateYouTubePostText('SEMINAR_INVITE', seminarPayload, {
        target_audience: 'eBay初心者の方',
      })

      expect(result).toContain('対象：eBay初心者の方')
    })

    it('should omit target_audience line when empty string', () => {
      const result = generateYouTubePostText('SEMINAR_INVITE', seminarPayload, {
        target_audience: '',
      })

      expect(result).not.toContain('対象：')
    })
  })

  describe('generateYouTubePostText - FREE_TRIAL_INVITE', () => {
    const freeTrialPayload = {
      tool_name: 'Musashi',
      one_liner: '出品作業を3倍速にするAIツール',
      url: 'https://example.com/signup',
    }

    it('should generate correct text for free trial invite', () => {
      const result = generateYouTubePostText('FREE_TRIAL_INVITE', freeTrialPayload)

      expect(result).toContain('【無料で試せます】Musashiを開放しました')
      expect(result).toContain('出品作業を3倍速にするAIツール')
      expect(result).toContain('https://example.com/signup')
      expect(result).toContain('#eBay #業務効率化 #ツール')
      expect(result).toContain('「どの作業が一番しんどい？」')
    })

    it('should handle special characters in tool name', () => {
      const payload = {
        ...freeTrialPayload,
        tool_name: 'ツール & サービス',
      }
      const result = generateYouTubePostText('FREE_TRIAL_INVITE', payload)

      expect(result).toContain('【無料で試せます】ツール & サービスを開放しました')
    })
  })

  describe('parseDateTimeFromEventDate', () => {
    it('should parse standard date format', () => {
      const result = parseDateTimeFromEventDate('2026年2月15日（土）14:00〜15:30')

      expect(result.date).toBe('2026年2月15日')
      expect(result.time).toBe('14:00')
    })

    it('should handle date without day of week', () => {
      const result = parseDateTimeFromEventDate('2026年3月1日 10:00')

      expect(result.date).toBe('2026年3月1日')
      expect(result.time).toBe('10:00')
    })

    it('should return original string when no date found', () => {
      const result = parseDateTimeFromEventDate('明日の午後')

      expect(result.date).toBe('明日の午後')
      expect(result.time).toBe('')
    })

    it('should handle date without time', () => {
      const result = parseDateTimeFromEventDate('2026年4月1日')

      expect(result.date).toBe('2026年4月1日')
      expect(result.time).toBe('')
    })
  })

  describe('YOUTUBE_STUDIO_URL', () => {
    it('should be the correct YouTube Studio URL', () => {
      expect(YOUTUBE_STUDIO_URL).toBe('https://studio.youtube.com/')
    })
  })

  describe('YOUTUBE_POST_LIMITS', () => {
    it('should have correct character limit', () => {
      expect(YOUTUBE_POST_LIMITS.maxCharacters).toBe(5000)
    })

    it('should have correct hashtag limit', () => {
      expect(YOUTUBE_POST_LIMITS.maxHashtags).toBe(3)
    })
  })

  describe('text length validation', () => {
    it('should generate text within YouTube limits', () => {
      const seminarResult = generateYouTubePostText('SEMINAR_INVITE', {
        event_name: 'eBay出品効率化セミナー',
        event_date: '2026年2月15日（土）14:00〜15:30',
        event_location: 'Zoomオンライン',
        url: 'https://example.com/seminar',
      })

      const freeTrialResult = generateYouTubePostText('FREE_TRIAL_INVITE', {
        tool_name: 'Musashi',
        one_liner: '出品作業を3倍速にするAIツール',
        url: 'https://example.com/signup',
      })

      expect(seminarResult.length).toBeLessThanOrEqual(YOUTUBE_POST_LIMITS.maxCharacters)
      expect(freeTrialResult.length).toBeLessThanOrEqual(YOUTUBE_POST_LIMITS.maxCharacters)
    })
  })
})
