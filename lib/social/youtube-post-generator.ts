/**
 * YouTube Community Post Text Generator
 * Generates text for YouTube community posts from campaign data
 */

import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

// YouTube Studio URL (most stable entry point)
export const YOUTUBE_STUDIO_URL = 'https://studio.youtube.com/'

// YouTube Community Post Limits
export const YOUTUBE_POST_LIMITS = {
  maxCharacters: 5000,
  maxHashtags: 3,
  recommendedLength: { min: 300, max: 800 },
} as const

// Seminar invite template
const SEMINAR_TEMPLATE = `【30分だけ】{{seminar_title}}を共有します

{{date}} {{time}}からオンラインで話します（{{duration_minutes}}分）
{{target_audience_line}}
・今日からすぐ効くやり方
・よくある落とし穴
・具体例（実例ベース）

参加はこちら（詳細/申込）
{{url}}

「参加」か「アーカイブ希望」ってコメントくれたら、あとでリマインドします！
#eBay #物販 #副業`

// Free trial invite template
const FREE_REGISTRATION_TEMPLATE = `【無料で試せます】{{tool_name}}を開放しました

{{one_liner}}

・作業がどれくらい減るか
・どのタイプの人にハマるか
・逆に合わないケース

登録はこちら
{{url}}

「どの作業が一番しんどい？」ってコメントで教えてください。次の改善に反映します！
#eBay #業務効率化 #ツール`

export interface SeminarYouTubeParams {
  duration_minutes?: number
  target_audience?: string
}

/**
 * Parse date and time from event_date string
 * @example "2026年2月15日（土）14:00〜15:30" -> { date: "2026年2月15日", time: "14:00" }
 */
export function parseDateTimeFromEventDate(eventDate: string): {
  date: string
  time: string
} {
  // Match Japanese date format: YYYY年M月D日
  const dateMatch = eventDate.match(/(\d+年\d+月\d+日)/)
  // Match time format: HH:MM
  const timeMatch = eventDate.match(/(\d{1,2}:\d{2})/)

  return {
    date: dateMatch ? dateMatch[1] : eventDate,
    time: timeMatch ? timeMatch[1] : '',
  }
}

/**
 * Generate YouTube community post text from campaign data
 */
export function generateYouTubePostText(
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  additionalParams?: SeminarYouTubeParams
): string {
  if (type === 'SEMINAR_INVITE') {
    const seminarPayload = payload as SeminarInvitePayload
    const { date, time } = parseDateTimeFromEventDate(seminarPayload.event_date)
    const durationMinutes = additionalParams?.duration_minutes ?? 30
    const targetAudience = additionalParams?.target_audience ?? 'eBay物販に興味がある方'

    // Build target audience line (omit if empty)
    const targetAudienceLine =
      targetAudience.trim() !== '' ? `対象：${targetAudience}` : ''

    let text = SEMINAR_TEMPLATE
      .replace('{{seminar_title}}', seminarPayload.event_name)
      .replace('{{date}}', date)
      .replace('{{time}}', time)
      .replace('{{duration_minutes}}', durationMinutes.toString())
      .replace('{{target_audience_line}}', targetAudienceLine)
      .replace('{{url}}', seminarPayload.url)

    // Clean up empty lines if target_audience_line was empty
    if (targetAudienceLine === '') {
      text = text.replace(/\n\n\n/g, '\n\n')
    }

    return text
  }

  // FREE_TRIAL_INVITE
  const trialPayload = payload as FreeTrialInvitePayload
  return FREE_REGISTRATION_TEMPLATE
    .replace('{{tool_name}}', trialPayload.tool_name)
    .replace('{{one_liner}}', trialPayload.one_liner)
    .replace('{{url}}', trialPayload.url)
}

export type YouTubeManualPostStatus = 'ready' | 'copied' | 'marked_posted'

export interface YouTubeManualPostPayload {
  campaign_id: string
  campaign_type: TemplateType
  generated_text: string
  copied_at?: string
  studio_opened_at?: string
  posted_at?: string
}
