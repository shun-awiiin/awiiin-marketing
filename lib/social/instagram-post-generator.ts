/**
 * Instagram Post Text Generator
 * Generates Instagram post caption from campaign data (2200 character limit)
 */

import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

// Instagram Web URL
export const INSTAGRAM_WEB_URL = 'https://www.instagram.com/'

// Instagram Post Limits
export const INSTAGRAM_POST_LIMITS = {
  maxCharacters: 2200,
  maxHashtags: 30,
  recommendedHashtags: 10,
} as const

// Seminar invite template
const SEMINAR_TEMPLATE = `{{seminar_title}}

{{date}}にオンラインセミナーを開催します。

【こんな方におすすめ】
{{target_audience}}

【内容】
{{content_points}}

【開催概要】
日時：{{event_date}}
場所：{{event_location}}
参加費：無料

詳細・お申込みはプロフィールのリンクから

{{hashtags}}`

// Free trial invite template
const FREE_TRIAL_TEMPLATE = `【無料で使えます】{{tool_name}}

{{one_liner}}

【このツールでできること】
{{features}}

【こんな方におすすめ】
{{target_audience}}

登録はプロフィールのリンクから

{{hashtags}}`

// Default hashtags
const DEFAULT_HASHTAGS = {
  seminar: '#eBay #eBay輸出 #物販 #副業 #セミナー #無料セミナー #オンラインセミナー #物販ビジネス #輸出ビジネス #副業初心者',
  freeTrial: '#eBay #eBay輸出 #物販 #業務効率化 #ツール #無料 #物販ビジネス #効率化 #時短 #副業',
} as const

export interface InstagramPostParams {
  target_audience?: string
  content_points?: string
  features?: string
  custom_hashtags?: string
}

/**
 * Parse date from event_date string
 */
function parseDateFromEventDate(eventDate: string): string {
  const dateMatch = eventDate.match(/(\d+月\d+日)/)
  return dateMatch ? dateMatch[1] : eventDate
}

/**
 * Generate Instagram post text from campaign data
 */
export function generateInstagramPostText(
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  params?: InstagramPostParams
): string {
  if (type === 'SEMINAR_INVITE') {
    const seminarPayload = payload as SeminarInvitePayload
    const date = parseDateFromEventDate(seminarPayload.event_date)

    const targetAudience = params?.target_audience ||
      '・eBay輸出に興味がある方\n・副業で収入を増やしたい方\n・物販ビジネスを始めたい方'

    const contentPoints = params?.content_points ||
      '・今日から使える実践テクニック\n・よくある失敗パターンと対策\n・実際の成功事例の紹介'

    const hashtags = params?.custom_hashtags || DEFAULT_HASHTAGS.seminar

    return SEMINAR_TEMPLATE
      .replace('{{seminar_title}}', seminarPayload.event_name)
      .replace('{{date}}', date)
      .replace('{{target_audience}}', targetAudience)
      .replace('{{content_points}}', contentPoints)
      .replace('{{event_date}}', seminarPayload.event_date)
      .replace('{{event_location}}', seminarPayload.event_location)
      .replace('{{hashtags}}', hashtags)
  }

  // FREE_TRIAL_INVITE
  const trialPayload = payload as FreeTrialInvitePayload

  const features = params?.features ||
    '・作業時間を大幅に短縮\n・面倒な作業を自動化\n・初心者でも簡単に使える'

  const targetAudience = params?.target_audience ||
    '・作業効率を上げたい方\n・時間を有効活用したい方\n・ビジネスを成長させたい方'

  const hashtags = params?.custom_hashtags || DEFAULT_HASHTAGS.freeTrial

  return FREE_TRIAL_TEMPLATE
    .replace('{{tool_name}}', trialPayload.tool_name)
    .replace('{{one_liner}}', trialPayload.one_liner)
    .replace('{{features}}', features)
    .replace('{{target_audience}}', targetAudience)
    .replace('{{hashtags}}', hashtags)
}

/**
 * Count hashtags in text
 */
export function countHashtags(text: string): number {
  const matches = text.match(/#[^\s#]+/g)
  return matches ? matches.length : 0
}

/**
 * Check if text exceeds Instagram character limit
 */
export function isInstagramTextTooLong(text: string): boolean {
  return text.length > INSTAGRAM_POST_LIMITS.maxCharacters
}

/**
 * Get default hashtags for a campaign type
 */
export function getDefaultHashtags(type: TemplateType): string {
  return type === 'SEMINAR_INVITE' ? DEFAULT_HASHTAGS.seminar : DEFAULT_HASHTAGS.freeTrial
}
