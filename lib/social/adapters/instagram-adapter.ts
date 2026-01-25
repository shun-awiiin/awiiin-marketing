/**
 * Instagram Adapter
 * Implements SocialMediaAdapter for Instagram Graph API
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

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'

/**
 * Instagram adapter implementing Instagram Graph API via Facebook
 */
export class InstagramAdapter extends BaseAdapter {
  readonly platform = 'instagram' as const
  readonly displayName = 'Instagram'
  readonly maxTextLength = 2200
  readonly supportedMediaTypes = ['image', 'video', 'carousel'] as const

  private get instagramAccountId(): string {
    return (this.account.metadata?.instagram_account_id as string) || this.account.providerAccountId
  }

  /**
   * Validate stored credentials
   */
  async validateCredentials(): Promise<AccountValidationResult> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${this.instagramAccountId}?fields=id,username,name,profile_picture_url&access_token=${this.accessToken}`
      )

      if (!response.ok) {
        if (response.status === 401 || response.status === 190) {
          return { valid: false, error: 'アクセストークンが無効または期限切れです' }
        }
        return { valid: false, error: `認証エラー: ${response.status}` }
      }

      const data = await response.json()

      return {
        valid: true,
        accountInfo: {
          displayName: data.name,
          username: data.username,
          profileImageUrl: data.profile_picture_url,
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
   * Refresh access token (Facebook long-lived tokens)
   */
  async refreshAccessToken(): Promise<OAuthTokens | null> {
    try {
      const config = getOAuthConfig('instagram')
      const result = await refreshAccessToken(config.tokenUrl, {
        refreshToken: this.accessToken, // Facebook uses access token for refresh
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
   * Validate content for Instagram
   */
  async validateContent(content: PostContent): Promise<ContentValidationResult> {
    const errors: ContentValidationResult['errors'] = []
    const warnings: ContentValidationResult['warnings'] = []

    // Instagram requires media for most post types
    if (!content.mediaUrls || content.mediaUrls.length === 0) {
      errors.push({
        field: 'mediaUrls',
        code: 'MEDIA_REQUIRED',
        message: 'Instagramの投稿には画像または動画が必要です',
      })
    }

    // Caption length
    if (content.text && content.text.length > this.maxTextLength) {
      errors.push({
        field: 'text',
        code: 'TEXT_TOO_LONG',
        message: `キャプションは${this.maxTextLength}文字以内にしてください（現在: ${content.text.length}文字）`,
      })
    }

    // Hashtag limit
    if (content.text) {
      const hashtags = content.text.match(/#\w+/g) || []
      if (hashtags.length > 30) {
        errors.push({
          field: 'text',
          code: 'TOO_MANY_HASHTAGS',
          message: 'ハッシュタグは30個までです',
        })
      }
      if (hashtags.length > 10) {
        warnings.push({
          field: 'text',
          code: 'MANY_HASHTAGS',
          message: 'ハッシュタグが多すぎる可能性があります',
          suggestion: '効果的なハッシュタグは5-10個程度です',
        })
      }
    }

    // Carousel limit
    if (content.mediaType === 'carousel' && content.mediaUrls && content.mediaUrls.length > 10) {
      errors.push({
        field: 'mediaUrls',
        code: 'TOO_MANY_IMAGES',
        message: 'カルーセル投稿は最大10枚までです',
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
   * Create a post on Instagram
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

      const igOptions = content.platformOptions?.instagram

      // Step 1: Create media container
      let containerId: string

      if (content.mediaType === 'carousel' && content.mediaUrls && content.mediaUrls.length > 1) {
        // Create carousel container
        containerId = await this.createCarouselContainer(content)
      } else if (content.mediaType === 'video' || igOptions?.isReel) {
        // Create video/reel container
        containerId = await this.createVideoContainer(content)
      } else {
        // Create single image container
        containerId = await this.createImageContainer(content)
      }

      // Step 2: Publish the container
      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${this.instagramAccountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: this.accessToken,
          }),
        }
      )

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error?.message || '投稿の公開に失敗しました',
          retryable: this.isRetryableError(publishResponse.status),
        }
      }

      const publishData = await publishResponse.json()

      return {
        success: true,
        platformPostId: publishData.id,
        platformUrl: `https://www.instagram.com/p/${publishData.id}/`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '投稿中にエラーが発生しました',
        retryable: true,
      }
    }
  }

  private async createImageContainer(content: PostContent): Promise<string> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${this.instagramAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: content.mediaUrls?.[0],
          caption: content.text,
          access_token: this.accessToken,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('画像コンテナの作成に失敗しました')
    }

    const data = await response.json()
    return data.id
  }

  private async createVideoContainer(content: PostContent): Promise<string> {
    const igOptions = content.platformOptions?.instagram

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.instagramAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: content.mediaUrls?.[0],
          caption: content.text,
          media_type: igOptions?.isReel ? 'REELS' : 'VIDEO',
          share_to_feed: igOptions?.shareToFeed !== false,
          access_token: this.accessToken,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('動画コンテナの作成に失敗しました')
    }

    const data = await response.json()

    // Wait for video processing
    await this.waitForMediaProcessing(data.id)

    return data.id
  }

  private async createCarouselContainer(content: PostContent): Promise<string> {
    // Create child containers for each item
    const childIds: string[] = []

    for (const mediaUrl of content.mediaUrls || []) {
      const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i)

      const response = await fetch(
        `${GRAPH_API_BASE}/${this.instagramAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            is_carousel_item: true,
            access_token: this.accessToken,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('カルーセルアイテムの作成に失敗しました')
      }

      const data = await response.json()
      childIds.push(data.id)
    }

    // Create carousel container
    const response = await fetch(
      `${GRAPH_API_BASE}/${this.instagramAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          caption: content.text,
          children: childIds,
          access_token: this.accessToken,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('カルーセルコンテナの作成に失敗しました')
    }

    const data = await response.json()
    return data.id
  }

  private async waitForMediaProcessing(containerId: string, maxWaitMs: number = 60000): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(
        `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${this.accessToken}`
      )

      if (!response.ok) {
        throw new Error('メディア処理状況の確認に失敗しました')
      }

      const data = await response.json()

      if (data.status_code === 'FINISHED') {
        return
      }

      if (data.status_code === 'ERROR') {
        throw new Error('メディア処理に失敗しました')
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    throw new Error('メディア処理がタイムアウトしました')
  }

  /**
   * Upload media (Instagram requires URL-based media)
   */
  async uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult> {
    // Instagram Graph API doesn't support direct uploads
    // Media must be hosted on a public URL
    return {
      success: false,
      error: 'Instagramは直接アップロードをサポートしていません。公開URLを使用してください。',
    }
  }

  /**
   * Get post status
   */
  async getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${platformPostId}?fields=id,like_count,comments_count&access_token=${this.accessToken}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'deleted' }
        }
        return { status: 'failed', error: `API error: ${response.status}` }
      }

      const data = await response.json()

      return {
        status: 'published',
        metrics: {
          likes: data.like_count,
          comments: data.comments_count,
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
   * Delete a post (not supported via API)
   */
  async deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }> {
    return {
      success: false,
      error: 'Instagram Graph APIでは投稿の削除はサポートされていません',
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo[]> {
    // Instagram/Facebook rate limits are complex and vary by endpoint
    return []
  }
}

// Register the adapter
adapterRegistry.register('instagram', InstagramAdapter)
