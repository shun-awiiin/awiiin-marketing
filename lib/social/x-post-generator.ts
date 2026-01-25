/**
 * X (Twitter) Post Text Generator
 * Generates tweet text from campaign data (280 character limit)
 */

import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

// X Web URL
export const X_WEB_URL = 'https://x.com/compose/tweet'

// X Post Limits
export const X_POST_LIMITS = {
  maxCharacters: 280,
  urlLength: 23, // URLs are counted as 23 characters
  maxHashtags: 3,
} as const

// Seminar invite template (short for X)
const SEMINAR_TEMPLATE = `{{seminar_title}}

{{date}} {{time}}〜オンライン開催

{{benefits}}

詳細・申込
{{url}}

#eBay #物販 #副業`

// Free trial invite template (short for X)
const FREE_TRIAL_TEMPLATE = `【無料】{{tool_name}}を公開しました

{{one_liner}}

登録はこちら
{{url}}

#eBay #業務効率化 #ツール`

export interface XPostParams {
  benefits?: string
}

/**
 * Parse date and time from event_date string
 */
function parseDateTimeFromEventDate(eventDate: string): {
  date: string
  time: string
} {
  const dateMatch = eventDate.match(/(\d+月\d+日)/)
  const timeMatch = eventDate.match(/(\d{1,2}:\d{2})/)

  return {
    date: dateMatch ? dateMatch[1] : eventDate,
    time: timeMatch ? timeMatch[1] : '',
  }
}

/**
 * Generate X (Twitter) post text from campaign data
 */
export function generateXPostText(
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  params?: XPostParams
): string {
  if (type === 'SEMINAR_INVITE') {
    const seminarPayload = payload as SeminarInvitePayload
    const { date, time } = parseDateTimeFromEventDate(seminarPayload.event_date)
    const benefits = params?.benefits || '実践ノウハウを共有します'

    return SEMINAR_TEMPLATE
      .replace('{{seminar_title}}', seminarPayload.event_name)
      .replace('{{date}}', date)
      .replace('{{time}}', time)
      .replace('{{benefits}}', benefits)
      .replace('{{url}}', seminarPayload.url)
  }

  // FREE_TRIAL_INVITE
  const trialPayload = payload as FreeTrialInvitePayload
  return FREE_TRIAL_TEMPLATE
    .replace('{{tool_name}}', trialPayload.tool_name)
    .replace('{{one_liner}}', trialPayload.one_liner)
    .replace('{{url}}', trialPayload.url)
}

/**
 * Calculate effective character count (URLs count as 23 chars)
 */
export function calculateXCharCount(text: string): number {
  // Replace URLs with 23-character placeholder for counting
  const urlRegex = /https?:\/\/[^\s]+/g
  const textWithNormalizedUrls = text.replace(urlRegex, 'x'.repeat(X_POST_LIMITS.urlLength))
  return textWithNormalizedUrls.length
}

/**
 * Check if text exceeds X character limit
 */
export function isXTextTooLong(text: string): boolean {
  return calculateXCharCount(text) > X_POST_LIMITS.maxCharacters
}
