/**
 * WhatsApp Adapter
 * Implements SocialMediaAdapter for WhatsApp Cloud API (Notifications Only)
 */

import { BaseAdapter, adapterRegistry, getOAuthConfig } from './interface'
import { refreshAccessToken } from '../oauth/state-manager'
import type {
  SocialAccount,
  PostContent,
  PostResult,
  MediaUploadResult,
  RateLimitInfo,
  ContentValidationResult,
  AccountValidationResult,
  EngagementMetrics,
  OAuthTokens,
} from '../types'

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v19.0'

/**
 * WhatsApp adapter for sending template messages
 * Note: WhatsApp Business API is for notifications, not social posting
 */
export class WhatsAppAdapter extends BaseAdapter {
  readonly platform = 'whatsapp' as const
  readonly displayName = 'WhatsApp Business'
  readonly maxTextLength = 4096
  readonly supportedMediaTypes = ['image', 'video'] as const

  private get phoneNumberId(): string {
    return (this.account.metadata?.phone_number_id as string) || this.account.providerAccountId
  }

  private get businessAccountId(): string {
    return (this.account.metadata?.business_account_id as string) || ''
  }

  /**
   * Validate stored credentials
   */
  async validateCredentials(): Promise<AccountValidationResult> {
    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${this.phoneNumberId}?access_token=${this.accessToken}`
      )

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: 'アクセストークンが無効または期限切れです' }
        }
        return { valid: false, error: `認証エラー: ${response.status}` }
      }

      const data = await response.json()

      return {
        valid: true,
        accountInfo: {
          displayName: data.verified_name || 'WhatsApp Business',
          username: data.display_phone_number,
        },
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '認証の検証に失敗しました',
      }
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<OAuthTokens | null> {
    try {
      const config = getOAuthConfig('whatsapp')
      const result = await refreshAccessToken(config.tokenUrl, {
        refreshToken: this.accessToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })

      return {
        accessToken: result.accessToken,
        expiresAt: result.expiresIn
          ? new Date(Date.now() + result.expiresIn * 1000)
          : undefined,
        scopes: config.scopes,
      }
    } catch {
      return null
    }
  }

  /**
   * Validate content for WhatsApp
   */
  async validateContent(content: PostContent): Promise<ContentValidationResult> {
    const errors: ContentValidationResult['errors'] = []
    const warnings: ContentValidationResult['warnings'] = []
    const waOptions = content.platformOptions?.whatsapp

    // WhatsApp requires template for business messaging
    if (!waOptions?.templateName) {
      errors.push({
        field: 'templateName',
        code: 'TEMPLATE_REQUIRED',
        message: 'WhatsAppビジネスメッセージにはテンプレート名が必要です',
      })
    }

    if (!waOptions?.templateLanguage) {
      errors.push({
        field: 'templateLanguage',
        code: 'LANGUAGE_REQUIRED',
        message: 'テンプレート言語を指定してください',
      })
    }

    if (!waOptions?.contactIds || waOptions.contactIds.length === 0) {
      errors.push({
        field: 'contactIds',
        code: 'RECIPIENTS_REQUIRED',
        message: '送信先を指定してください',
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedContent: content,
    }
  }

  /**
   * Send template message via WhatsApp
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      const validation = await this.validateContent(content)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.message).join(', '),
          retryable: false,
        }
      }

      const waOptions = content.platformOptions?.whatsapp

      if (!waOptions) {
        return {
          success: false,
          error: 'WhatsApp投稿オプションが必要です',
          retryable: false,
        }
      }

      // Send to each recipient
      const results: Array<{ to: string; success: boolean; messageId?: string; error?: string }> = []

      for (const recipientPhone of waOptions.contactIds) {
        try {
          const response = await fetch(
            `${WHATSAPP_API_BASE}/${this.phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: recipientPhone,
                type: 'template',
                template: {
                  name: waOptions.templateName,
                  language: {
                    code: waOptions.templateLanguage,
                  },
                  components: waOptions.templateComponents || [],
                },
              }),
            }
          )

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            results.push({
              to: recipientPhone,
              success: false,
              error: errorData.error?.message || 'メッセージ送信に失敗しました',
            })
          } else {
            const data = await response.json()
            results.push({
              to: recipientPhone,
              success: true,
              messageId: data.messages?.[0]?.id,
            })
          }
        } catch (err) {
          results.push({
            to: recipientPhone,
            success: false,
            error: err instanceof Error ? err.message : '送信エラー',
          })
        }
      }

      const successCount = results.filter((r) => r.success).length
      const allSuccessful = successCount === results.length

      if (allSuccessful) {
        return {
          success: true,
          platformPostId: results.map((r) => r.messageId).join(','),
        }
      }

      const failedCount = results.length - successCount
      return {
        success: successCount > 0,
        error: `${failedCount}件のメッセージ送信に失敗しました`,
        retryable: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '送信中にエラーが発生しました',
        retryable: true,
      }
    }
  }

  /**
   * Upload media for WhatsApp
   */
  async uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult> {
    try {
      const formData = new FormData()
      formData.append('file', new Blob([new Uint8Array(file)], { type: mimeType }), filename)
      formData.append('messaging_product', 'whatsapp')

      const response = await fetch(
        `${WHATSAPP_API_BASE}/${this.phoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error('メディアアップロードに失敗しました')
      }

      const data = await response.json()

      return {
        success: true,
        mediaId: data.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'アップロードに失敗しました',
      }
    }
  }

  /**
   * Get message status
   */
  async getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }> {
    // WhatsApp message status is received via webhooks, not polling
    return {
      status: 'published',
    }
  }

  /**
   * Delete is not applicable for WhatsApp messages
   */
  async deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }> {
    return {
      success: false,
      error: 'WhatsAppメッセージは削除できません',
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo[]> {
    // WhatsApp uses tier-based messaging limits
    return []
  }
}

// Register the adapter
adapterRegistry.register('whatsapp', WhatsAppAdapter)
