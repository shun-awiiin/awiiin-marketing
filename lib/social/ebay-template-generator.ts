/**
 * eBay SNS Promotion Template Generator
 * Generates eBay-compliant templates for SNS promotion
 *
 * POLICY NOTES:
 * - OK: Package inserts, thank you cards (outside eBay platform)
 * - OK: Post-purchase messages for customer service
 * - NG: Directing buyers to purchase outside eBay
 * - NG: Including contact info in listings
 */

// Prohibited phrases that violate eBay policy
const PROHIBITED_PHRASES = [
  'buy directly',
  'purchase outside',
  'contact me directly',
  'off-ebay',
  'outside ebay',
  'direct transaction',
  'avoid fees',
  'skip ebay',
  'email me',
  'call me',
  'text me',
  'whatsapp me',
  '直接取引',
  'eBay外',
  '手数料回避',
] as const

// Warning phrases that need caution
const WARNING_PHRASES = [
  'discount code',
  'coupon',
  'special offer',
  'exclusive deal',
  '割引',
  'クーポン',
] as const

export interface PolicyCheckResult {
  isCompliant: boolean
  violations: string[]
  warnings: string[]
}

/**
 * Check if text complies with eBay policy
 */
export function checkEbayPolicyCompliance(text: string): PolicyCheckResult {
  const lowerText = text.toLowerCase()
  const violations: string[] = []
  const warnings: string[] = []

  // Check for prohibited phrases
  for (const phrase of PROHIBITED_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(`禁止表現を検出: "${phrase}"`)
    }
  }

  // Check for warning phrases
  for (const phrase of WARNING_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      warnings.push(`注意が必要: "${phrase}" - eBay外での特典提供は問題ありませんが、eBay取引を避ける意図と誤解されないようにしてください`)
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    warnings,
  }
}

// Template types
export type EbayTemplateType =
  | 'thank_you_card'
  | 'package_insert'
  | 'post_purchase_message'

export interface EbayTemplateParams {
  storeName: string
  instagramHandle?: string
  xHandle?: string
  youtubeChannel?: string
  discountCode?: string
  discountPercent?: number
  customMessage?: string
}

// Thank You Card Templates
const THANK_YOU_CARD_TEMPLATES = {
  english: `Thank you for your purchase!

We hope you love your item.

Stay connected for new arrivals & tips:
{{social_links}}

{{discount_section}}

- {{store_name}}`,

  japanese: `ご購入ありがとうございます！

商品を気に入っていただけると嬉しいです。

新商品情報やお役立ち情報はこちら：
{{social_links}}

{{discount_section}}

- {{store_name}}`,

  bilingual: `Thank you! / ありがとうございます！

We hope you love your item.
商品を気に入っていただけると嬉しいです。

Follow us / フォローはこちら:
{{social_links}}

{{discount_section}}

- {{store_name}}`,
} as const

// Package Insert Templates
const PACKAGE_INSERT_TEMPLATES = {
  english: `=================================
     THANK YOU FOR YOUR ORDER!
=================================

Your satisfaction is our priority.
If you have any questions about your
item, please contact us through eBay.

--------- STAY CONNECTED ---------

Follow us for:
- New product announcements
- Styling tips & ideas
- Behind-the-scenes content

{{social_links}}

{{discount_section}}

=================================
          {{store_name}}
=================================`,

  japanese: `=================================
     ご注文ありがとうございます！
=================================

お客様のご満足が私たちの喜びです。
商品についてご不明な点がございましたら
eBayメッセージよりお問い合わせください。

-------- SNSをフォロー --------

フォローすると：
・新商品情報をいち早くお届け
・使い方のヒント
・舞台裏コンテンツ

{{social_links}}

{{discount_section}}

=================================
          {{store_name}}
=================================`,
} as const

// Post-Purchase Message Templates (eBay Message)
const POST_PURCHASE_MESSAGE_TEMPLATES = {
  english: `Hi!

Thank you for your purchase. Your order has been shipped!

Tracking: {{tracking_placeholder}}
Estimated arrival: {{date_placeholder}}

If you have any questions, please don't hesitate to reach out.

We also share new arrivals and tips on our social media:
{{social_links}}

Thank you for choosing {{store_name}}!`,

  japanese: `こんにちは！

この度はご購入いただきありがとうございます。
商品を発送いたしました！

追跡番号: {{tracking_placeholder}}
到着予定: {{date_placeholder}}

ご不明な点がございましたら、お気軽にお問い合わせください。

新商品情報やお役立ち情報はSNSでも発信しています：
{{social_links}}

{{store_name}}をご利用いただきありがとうございます！`,
} as const

export type TemplateLanguage = 'english' | 'japanese' | 'bilingual'

/**
 * Generate social links section
 */
function generateSocialLinks(params: EbayTemplateParams): string {
  const links: string[] = []

  if (params.instagramHandle) {
    links.push(`Instagram: @${params.instagramHandle.replace('@', '')}`)
  }
  if (params.xHandle) {
    links.push(`X (Twitter): @${params.xHandle.replace('@', '')}`)
  }
  if (params.youtubeChannel) {
    links.push(`YouTube: ${params.youtubeChannel}`)
  }

  return links.length > 0 ? links.join('\n') : '(SNSアカウントを設定してください)'
}

/**
 * Generate discount section
 */
function generateDiscountSection(params: EbayTemplateParams, language: TemplateLanguage): string {
  if (!params.discountCode || !params.discountPercent) {
    return ''
  }

  if (language === 'japanese') {
    return `
-------- フォロワー特典 --------
SNSフォローで次回${params.discountPercent}%OFF！
コード: ${params.discountCode}`
  }

  if (language === 'bilingual') {
    return `
-------- FOLLOWER BENEFIT --------
Follow us & get ${params.discountPercent}% OFF next order!
フォローで次回${params.discountPercent}%OFF！
Code/コード: ${params.discountCode}`
  }

  return `
-------- FOLLOWER BENEFIT --------
Follow us and get ${params.discountPercent}% OFF your next order!
Code: ${params.discountCode}`
}

/**
 * Generate Thank You Card
 */
export function generateThankYouCard(
  params: EbayTemplateParams,
  language: TemplateLanguage = 'english'
): string {
  const template = language === 'bilingual'
    ? THANK_YOU_CARD_TEMPLATES.bilingual
    : language === 'japanese'
      ? THANK_YOU_CARD_TEMPLATES.japanese
      : THANK_YOU_CARD_TEMPLATES.english

  return template
    .replace('{{social_links}}', generateSocialLinks(params))
    .replace('{{discount_section}}', generateDiscountSection(params, language))
    .replace('{{store_name}}', params.storeName)
    .replace(/\n{3,}/g, '\n\n') // Clean up extra newlines
}

/**
 * Generate Package Insert
 */
export function generatePackageInsert(
  params: EbayTemplateParams,
  language: TemplateLanguage = 'english'
): string {
  const template = language === 'japanese'
    ? PACKAGE_INSERT_TEMPLATES.japanese
    : PACKAGE_INSERT_TEMPLATES.english

  return template
    .replace('{{social_links}}', generateSocialLinks(params))
    .replace('{{discount_section}}', generateDiscountSection(params, language))
    .replace(/\{\{store_name\}\}/g, params.storeName)
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Generate Post-Purchase Message
 */
export function generatePostPurchaseMessage(
  params: EbayTemplateParams,
  language: TemplateLanguage = 'english'
): string {
  const template = language === 'japanese'
    ? POST_PURCHASE_MESSAGE_TEMPLATES.japanese
    : POST_PURCHASE_MESSAGE_TEMPLATES.english

  return template
    .replace('{{social_links}}', generateSocialLinks(params))
    .replace(/\{\{store_name\}\}/g, params.storeName)
    .replace('{{tracking_placeholder}}', '[追跡番号を入力]')
    .replace('{{date_placeholder}}', '[到着予定日を入力]')
}

/**
 * Get all template types with descriptions
 */
export function getEbayTemplateTypes(): Array<{
  id: EbayTemplateType
  name: string
  description: string
  policyStatus: 'safe' | 'caution'
  policyNote: string
}> {
  return [
    {
      id: 'thank_you_card',
      name: 'サンキューカード',
      description: '商品に同梱する感謝カード（印刷用）',
      policyStatus: 'safe',
      policyNote: 'eBayプラットフォーム外のため規約適用外。安全に使用できます。',
    },
    {
      id: 'package_insert',
      name: 'パッケージインサート',
      description: '商品に同梱するチラシ（印刷用）',
      policyStatus: 'safe',
      policyNote: 'eBayプラットフォーム外のため規約適用外。安全に使用できます。',
    },
    {
      id: 'post_purchase_message',
      name: '購入後メッセージ',
      description: 'eBayメッセージで送る発送通知',
      policyStatus: 'caution',
      policyNote: 'カスタマーサービス目的であれば許容。取引誘導と誤解される表現は避けてください。',
    },
  ]
}
