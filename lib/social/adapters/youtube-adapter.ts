/**
 * YouTube Adapter
 * Implements SocialMediaAdapter for YouTube Data API v3
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

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'

/**
 * YouTube adapter implementing YouTube Data API v3
 */
export class YouTubeAdapter extends BaseAdapter {
  readonly platform = 'youtube' as const
  readonly displayName = 'YouTube'
  readonly maxTextLength = 5000
  readonly supportedMediaTypes = ['video'] as const

  /**
   * Validate stored credentials
   */
  async validateCredentials(): Promise<AccountValidationResult> {
    try {
      const response = await fetch(
        `${YOUTUBE_API_BASE}/channels?part=snippet&mine=true`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: 'アクセストークンが無効または期限切れです' }
        }
        return { valid: false, error: `認証エラー: ${response.status}` }
      }

      const data = await response.json()
      const channel = data.items?.[0]

      if (!channel) {
        return { valid: false, error: 'YouTubeチャンネルが見つかりません' }
      }

      return {
        valid: true,
        accountInfo: {
          displayName: channel.snippet.title,
          username: channel.snippet.customUrl || channel.id,
          profileImageUrl: channel.snippet.thumbnails?.default?.url,
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
    if (!this.refreshToken) {
      return null
    }

    try {
      const config = getOAuthConfig('youtube')
      const result = await refreshAccessToken(config.tokenUrl, {
        refreshToken: this.refreshToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || this.refreshToken,
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
   * Validate content for YouTube
   */
  async validateContent(content: PostContent): Promise<ContentValidationResult> {
    const errors: ContentValidationResult['errors'] = []
    const warnings: ContentValidationResult['warnings'] = []
    const ytOptions = content.platformOptions?.youtube

    // YouTube requires video
    if (!content.mediaUrls || content.mediaUrls.length === 0) {
      errors.push({
        field: 'mediaUrls',
        code: 'VIDEO_REQUIRED',
        message: 'YouTubeには動画が必要です',
      })
    }

    // Title validation
    if (!ytOptions?.title) {
      errors.push({
        field: 'title',
        code: 'TITLE_REQUIRED',
        message: 'タイトルは必須です',
      })
    } else if (ytOptions.title.length > 100) {
      errors.push({
        field: 'title',
        code: 'TITLE_TOO_LONG',
        message: 'タイトルは100文字以内にしてください',
      })
    }

    // Description validation
    if (ytOptions?.description && ytOptions.description.length > 5000) {
      errors.push({
        field: 'description',
        code: 'DESCRIPTION_TOO_LONG',
        message: '説明は5000文字以内にしてください',
      })
    }

    // Tags validation
    if (ytOptions?.tags) {
      const totalTagLength = ytOptions.tags.join('').length
      if (totalTagLength > 500) {
        errors.push({
          field: 'tags',
          code: 'TAGS_TOO_LONG',
          message: 'タグの合計は500文字以内にしてください',
        })
      }
    }

    // Privacy status
    if (ytOptions?.privacyStatus && !['public', 'private', 'unlisted'].includes(ytOptions.privacyStatus)) {
      errors.push({
        field: 'privacyStatus',
        code: 'INVALID_PRIVACY',
        message: '無効な公開設定です',
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
   * Create a video post on YouTube
   * Note: Full video upload requires resumable upload protocol
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

      const ytOptions = content.platformOptions?.youtube

      if (!ytOptions) {
        return {
          success: false,
          error: 'YouTube投稿オプションが必要です',
          retryable: false,
        }
      }

      // For URL-based videos, we need to use a different approach
      // YouTube API requires direct video upload, not URL-based
      // This implementation shows the API structure

      const videoResource = {
        snippet: {
          title: ytOptions.title,
          description: ytOptions.description || content.text || '',
          tags: ytOptions.tags || [],
          categoryId: ytOptions.categoryId || '22', // 22 = People & Blogs
        },
        status: {
          privacyStatus: ytOptions.privacyStatus || 'private',
          publishAt: ytOptions.scheduledStartTime?.toISOString(),
          selfDeclaredMadeForKids: false,
        },
      }

      // Note: Actual video upload requires:
      // 1. Initialize resumable upload
      // 2. Upload video in chunks
      // 3. Set metadata after upload

      return {
        success: false,
        error: 'YouTube動画アップロードは直接アップロードが必要です。管理画面からアップロードしてください。',
        retryable: false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '投稿中にエラーが発生しました',
        retryable: true,
      }
    }
  }

  /**
   * Upload video to YouTube (resumable upload)
   */
  async uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult> {
    try {
      // Step 1: Initialize resumable upload
      const initResponse = await fetch(
        `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
        {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
            'X-Upload-Content-Length': file.length.toString(),
            'X-Upload-Content-Type': mimeType,
          },
          body: JSON.stringify({
            snippet: {
              title: filename,
              description: '',
            },
            status: {
              privacyStatus: 'private',
            },
          }),
        }
      )

      if (!initResponse.ok) {
        throw new Error('アップロードの初期化に失敗しました')
      }

      const uploadUrl = initResponse.headers.get('location')
      if (!uploadUrl) {
        throw new Error('アップロードURLが取得できませんでした')
      }

      // Step 2: Upload video content
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': file.length.toString(),
        },
        body: new Uint8Array(file),
      })

      if (!uploadResponse.ok) {
        throw new Error('動画のアップロードに失敗しました')
      }

      const videoData = await uploadResponse.json()

      return {
        success: true,
        mediaId: videoData.id,
        mediaUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'アップロードに失敗しました',
      }
    }
  }

  /**
   * Get video status
   */
  async getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }> {
    try {
      const response = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet,status,statistics&id=${platformPostId}`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      )

      if (!response.ok) {
        return { status: 'failed', error: `API error: ${response.status}` }
      }

      const data = await response.json()
      const video = data.items?.[0]

      if (!video) {
        return { status: 'deleted' }
      }

      const status = video.status.uploadStatus === 'processed'
        ? 'published'
        : video.status.uploadStatus === 'uploaded' || video.status.uploadStatus === 'processing'
        ? 'processing'
        : 'failed'

      return {
        status,
        metrics: {
          views: parseInt(video.statistics?.viewCount || '0', 10),
          likes: parseInt(video.statistics?.likeCount || '0', 10),
          comments: parseInt(video.statistics?.commentCount || '0', 10),
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
   * Delete a video
   */
  async deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await fetch(
        `${YOUTUBE_API_BASE}/videos?id=${platformPostId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      )

      if (!response.ok && response.status !== 204) {
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
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo[]> {
    // YouTube API uses quota-based rate limiting, not request-based
    // Quota is tracked per project in Google Cloud Console
    return []
  }
}

// Register the adapter
adapterRegistry.register('youtube', YouTubeAdapter)
