/**
 * WhatsApp DM Text Generator
 * Generates DM text for WhatsApp from campaign data
 */

import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

// WhatsApp Web URL
export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/'

// WhatsApp Message Limits
export const WHATSAPP_MESSAGE_LIMITS = {
  maxCharacters: 4096,
  recommendedLength: { min: 100, max: 500 },
} as const

// Seminar invite DM template
const SEMINAR_DM_TEMPLATE = `{{customer_name}}様

お世話になっております。

{{date}}に開催予定の「{{seminar_title}}」のご案内です。

【開催概要】
日時：{{event_date}}
場所：{{event_location}}
内容：{{seminar_description}}

ご参加いただける場合は、以下よりお申し込みください。
{{url}}

ご不明な点がございましたら、お気軽にご連絡ください。

よろしくお願いいたします。`

// Free trial invite DM template
const FREE_TRIAL_DM_TEMPLATE = `{{customer_name}}様

お世話になっております。

この度、「{{tool_name}}」の無料トライアルを開始いたしました。

{{one_liner}}

以下より無料でお試しいただけます。
{{url}}

ご質問やご不明な点がございましたら、お気軽にご連絡ください。

よろしくお願いいたします。`

// Customer support response templates
const SUPPORT_TEMPLATES = {
  inquiry_received: `{{customer_name}}様

お問い合わせいただきありがとうございます。

ご連絡いただいた内容について確認いたしました。
{{response_content}}

その他ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。`,

  follow_up: `{{customer_name}}様

お世話になっております。

先日のお問い合わせについて、その後いかがでしょうか。

何かご不明な点やお困りのことがございましたら、遠慮なくご連絡ください。

引き続きよろしくお願いいたします。`,

  thank_you: `{{customer_name}}様

この度はご利用いただき、誠にありがとうございます。

今後ともよろしくお願いいたします。

ご質問等ございましたら、お気軽にご連絡ください。`,
} as const

export type SupportTemplateType = keyof typeof SUPPORT_TEMPLATES

export interface WhatsAppDMParams {
  customer_name?: string
  seminar_description?: string
  response_content?: string
}

/**
 * Generate WhatsApp DM text from campaign data
 */
export function generateWhatsAppDMText(
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  params?: WhatsAppDMParams
): string {
  const customerName = params?.customer_name || 'お客様'

  if (type === 'SEMINAR_INVITE') {
    const seminarPayload = payload as SeminarInvitePayload
    const dateMatch = seminarPayload.event_date.match(/(\d+年\d+月\d+日)/)
    const shortDate = dateMatch ? dateMatch[1] : seminarPayload.event_date

    return SEMINAR_DM_TEMPLATE
      .replace(/\{\{customer_name\}\}/g, customerName)
      .replace('{{date}}', shortDate)
      .replace('{{seminar_title}}', seminarPayload.event_name)
      .replace('{{event_date}}', seminarPayload.event_date)
      .replace('{{event_location}}', seminarPayload.event_location)
      .replace('{{seminar_description}}', params?.seminar_description || 'eBay物販に関する実践的なノウハウをお伝えします')
      .replace('{{url}}', seminarPayload.url)
  }

  // FREE_TRIAL_INVITE
  const trialPayload = payload as FreeTrialInvitePayload
  return FREE_TRIAL_DM_TEMPLATE
    .replace(/\{\{customer_name\}\}/g, customerName)
    .replace('{{tool_name}}', trialPayload.tool_name)
    .replace('{{one_liner}}', trialPayload.one_liner)
    .replace('{{url}}', trialPayload.url)
}

/**
 * Generate customer support DM text
 */
export function generateSupportDMText(
  templateType: SupportTemplateType,
  params: WhatsAppDMParams
): string {
  const template = SUPPORT_TEMPLATES[templateType]
  const customerName = params.customer_name || 'お客様'

  return template
    .replace(/\{\{customer_name\}\}/g, customerName)
    .replace('{{response_content}}', params.response_content || '')
}

/**
 * Get available support templates
 */
export function getSupportTemplates(): Array<{
  id: SupportTemplateType
  name: string
  description: string
}> {
  return [
    {
      id: 'inquiry_received',
      name: 'お問い合わせ回答',
      description: 'お客様からのお問い合わせに対する回答',
    },
    {
      id: 'follow_up',
      name: 'フォローアップ',
      description: '過去のお問い合わせ後のフォローアップ',
    },
    {
      id: 'thank_you',
      name: 'お礼メッセージ',
      description: 'ご利用・ご購入へのお礼',
    },
  ]
}
