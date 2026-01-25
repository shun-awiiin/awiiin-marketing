/**
 * X (Twitter) Adapter
 * Implements SocialMediaAdapter for Twitter API v2
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
  PLATFORM_LIMITS,
} from '../types'

const X_API_BASE = 'https://api.twitter.com/2'
const X_UPLOAD_BASE = 'https://upload.twitter.com/1.1'

/**
 * X (Twitter) adapter implementing Twitter API v2
 */
export class XAdapter extends BaseAdapter {
  readonly platform = 'x' as const
  readonly displayName = 'X (Twitter)'
  readonly maxTextLength = 280
  readonly supportedMediaTypes = ['image', 'video'] as const

  /**
   * Validate stored credentials by fetching user info
   */
  async validateCredentials(): Promise<AccountValidationResult> {
    try {
      const response = await fetch(`${X_API_BASE}/users/me?user.fields=profile_image_url,username,name`, {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: 'アクセストークンが無効または期限切れです' }
        }
        return { valid: false, error: `認証エラー: ${response.status}` }
      }

      const data = await response.json()
      const user = data.data

      return {
        valid: true,
        accountInfo: {
          displayName: user.name,
          username: user.username,
          profileImageUrl: user.profile_image_url,
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
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthTokens | null> {
    if (!this.refreshToken) {
      return null
    }

    try {
      const config = getOAuthConfig('x')
      const result = await refreshAccessToken(config.tokenUrl, {
        refreshToken: this.refreshToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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
   * Validate content before posting
   */
  async validateContent(content: PostContent): Promise<ContentValidationResult> {
    const errors: ContentValidationResult['errors'] = []
    const warnings: ContentValidationResult['warnings'] = []

    // Text validation
    if (!content.text && (!content.mediaUrls || content.mediaUrls.length === 0)) {
      errors.push({
        field: 'text',
        code: 'CONTENT_REQUIRED',
        message: 'テキストまたはメディアが必要です',
      })
    }

    if (content.text) {
      // Character count (Twitter counts URLs as 23 chars)
      const urlRegex = /https?:\/\/[^\s]+/g
      const urls = content.text.match(urlRegex) || []
      let adjustedLength = content.text.length

      for (const url of urls) {
        adjustedLength = adjustedLength - url.length + 23
      }

      if (adjustedLength > this.maxTextLength) {
        errors.push({
          field: 'text',
          code: 'TEXT_TOO_LONG',
          message: `テキストは${this.maxTextLength}文字以内にしてください（URLは23文字としてカウント、現在: ${adjustedLength}文字）`,
        })
      }

      // Check hashtag count
      const hashtags = content.text.match(/#\w+/g) || []
      if (hashtags.length > 10) {
        warnings.push({
          field: 'text',
          code: 'TOO_MANY_HASHTAGS',
          message: 'ハッシュタグが多すぎる可能性があります（10個以上）',
          suggestion: 'ハッシュタグは5-7個程度が最適です',
        })
      }
    }

    // Media validation
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      if (content.mediaType === 'image' && content.mediaUrls.length > 4) {
        errors.push({
          field: 'mediaUrls',
          code: 'TOO_MANY_IMAGES',
          message: '画像は最大4枚までです',
        })
      }

      if (content.mediaType === 'video' && content.mediaUrls.length > 1) {
        errors.push({
          field: 'mediaUrls',
          code: 'TOO_MANY_VIDEOS',
          message: '動画は1つまでです',
        })
      }
    }

    // X-specific options validation
    const xOptions = content.platformOptions?.x
    if (xOptions?.pollOptions) {
      if (xOptions.pollOptions.length < 2 || xOptions.pollOptions.length > 4) {
        errors.push({
          field: 'pollOptions',
          code: 'INVALID_POLL_OPTIONS',
          message: '投票オプションは2-4個必要です',
        })
      }

      if (xOptions.pollDurationMinutes && (xOptions.pollDurationMinutes < 5 || xOptions.pollDurationMinutes > 10080)) {
        errors.push({
          field: 'pollDurationMinutes',
          code: 'INVALID_POLL_DURATION',
          message: '投票期間は5分から7日（10080分）の間で設定してください',
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedContent: content,
    }
  }

  /**
   * Create a post (tweet) on X
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      // Validate content first
      const validation = await this.validateContent(content)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.message).join(', '),
          retryable: false,
        }
      }

      // Build tweet payload
      const payload: Record<string, unknown> = {}

      if (content.text) {
        payload.text = content.text
      }

      // Add media if present
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        // Assume mediaUrls are already media IDs for X
        payload.media = {
          media_ids: content.mediaUrls,
        }
      }

      // X-specific options
      const xOptions = content.platformOptions?.x

      if (xOptions?.replyTo) {
        payload.reply = {
          in_reply_to_tweet_id: xOptions.replyTo,
        }
      }

      if (xOptions?.quotePost) {
        payload.quote_tweet_id = xOptions.quotePost
      }

      if (xOptions?.replySettings) {
        payload.reply_settings = xOptions.replySettings
      }

      if (xOptions?.pollOptions) {
        payload.poll = {
          options: xOptions.pollOptions.map((label) => ({ label })),
          duration_minutes: xOptions.pollDurationMinutes || 1440,
        }
      }

      const response = await fetch(`${X_API_BASE}/tweets`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || errorData.title || 'ツイートの投稿に失敗しました'

        return {
          success: false,
          error: errorMessage,
          retryable: this.isRetryableError(response.status),
        }
      }

      const data = await response.json()
      const tweetId = data.data.id

      return {
        success: true,
        platformPostId: tweetId,
        platformUrl: `https://x.com/${this.account.username}/status/${tweetId}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ツイートの投稿中にエラーが発生しました',
        retryable: true,
      }
    }
  }

  /**
   * Upload media to X
   * Uses chunked upload for large files
   */
  async uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult> {
    try {
      const totalBytes = file.length

      // Initialize upload
      const initResponse = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          command: 'INIT',
          total_bytes: totalBytes.toString(),
          media_type: mimeType,
        }),
      })

      if (!initResponse.ok) {
        return {
          success: false,
          error: 'メディアアップロードの初期化に失敗しました',
        }
      }

      const initData = await initResponse.json()
      const mediaId = initData.media_id_string

      // Append chunks (max 5MB per chunk)
      const chunkSize = 5 * 1024 * 1024
      let segmentIndex = 0

      for (let offset = 0; offset < totalBytes; offset += chunkSize) {
        const chunk = file.subarray(offset, Math.min(offset + chunkSize, totalBytes))
        const base64Chunk = chunk.toString('base64')

        const appendResponse = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            command: 'APPEND',
            media_id: mediaId,
            media_data: base64Chunk,
            segment_index: segmentIndex.toString(),
          }),
        })

        if (!appendResponse.ok) {
          return {
            success: false,
            error: `メディアチャンク${segmentIndex}のアップロードに失敗しました`,
          }
        }

        segmentIndex++
      }

      // Finalize upload
      const finalizeResponse = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          command: 'FINALIZE',
          media_id: mediaId,
        }),
      })

      if (!finalizeResponse.ok) {
        return {
          success: false,
          error: 'メディアアップロードの完了処理に失敗しました',
        }
      }

      const finalizeData = await finalizeResponse.json()

      // Check processing status for video
      if (finalizeData.processing_info) {
        const processingResult = await this.waitForMediaProcessing(mediaId)
        if (!processingResult.success) {
          return processingResult
        }
      }

      return {
        success: true,
        mediaId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'メディアアップロードに失敗しました',
      }
    }
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForMediaProcessing(
    mediaId: string,
    maxWaitMs: number = 60000
  ): Promise<MediaUploadResult> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const statusResponse = await fetch(
        `${X_UPLOAD_BASE}/media/upload.json?command=STATUS&media_id=${mediaId}`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      )

      if (!statusResponse.ok) {
        return {
          success: false,
          error: 'メディア処理状況の確認に失敗しました',
        }
      }

      const statusData = await statusResponse.json()
      const state = statusData.processing_info?.state

      if (state === 'succeeded') {
        return { success: true, mediaId }
      }

      if (state === 'failed') {
        return {
          success: false,
          error: statusData.processing_info?.error?.message || 'メディア処理に失敗しました',
        }
      }

      // Wait before next check
      const checkAfterSecs = statusData.processing_info?.check_after_secs || 5
      await new Promise((resolve) => setTimeout(resolve, checkAfterSecs * 1000))
    }

    return {
      success: false,
      error: 'メディア処理がタイムアウトしました',
    }
  }

  /**
   * Get status of a posted tweet
   */
  async getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }> {
    try {
      const response = await fetch(
        `${X_API_BASE}/tweets/${platformPostId}?tweet.fields=public_metrics,non_public_metrics`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'deleted' }
        }
        return { status: 'failed', error: `API error: ${response.status}` }
      }

      const data = await response.json()
      const tweet = data.data

      if (!tweet) {
        return { status: 'deleted' }
      }

      const publicMetrics = tweet.public_metrics || {}
      const nonPublicMetrics = tweet.non_public_metrics || {}

      return {
        status: 'published',
        metrics: {
          likes: publicMetrics.like_count,
          comments: publicMetrics.reply_count,
          shares: publicMetrics.retweet_count + (publicMetrics.quote_count || 0),
          impressions: nonPublicMetrics.impression_count,
          clicks: nonPublicMetrics.url_link_clicks,
        },
      }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'ステータスの取得に失敗しました',
      }
    }
  }

  /**
   * Delete a tweet
   */
  async deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await fetch(`${X_API_BASE}/tweets/${platformPostId}`, {
        method: 'DELETE',
        headers: {
          Authorization: this.getAuthHeader(),
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true } // Already deleted
        }
        return { success: false, error: `削除に失敗しました: ${response.status}` }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '削除に失敗しました',
      }
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo[]> {
    // X API v2 rate limits are returned in response headers
    // We track the main endpoints
    const endpoints = [
      { path: '/tweets', name: 'Post Tweet' },
      { path: '/users/me', name: 'Get User' },
    ]

    const results: RateLimitInfo[] = []

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${X_API_BASE}${endpoint.path}`, {
          method: 'HEAD',
          headers: {
            Authorization: this.getAuthHeader(),
          },
        })

        const remaining = parseInt(response.headers.get('x-rate-limit-remaining') || '0', 10)
        const limit = parseInt(response.headers.get('x-rate-limit-limit') || '0', 10)
        const reset = parseInt(response.headers.get('x-rate-limit-reset') || '0', 10)

        results.push({
          endpoint: endpoint.name,
          remaining,
          limit,
          resetAt: new Date(reset * 1000),
          windowSeconds: 900, // 15 minutes for most X endpoints
        })
      } catch {
        // Skip failed endpoints
      }
    }

    return results
  }
}

// Register the adapter
adapterRegistry.register('x', XAdapter)
