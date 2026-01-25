/**
 * Social Media Adapter Interface
 * Defines the contract for all platform-specific adapters
 */

import type {
  SocialProvider,
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

/**
 * Unified interface for social media platform adapters
 * All platform-specific adapters must implement this interface
 */
export interface SocialMediaAdapter {
  /** Platform identifier */
  readonly platform: SocialProvider

  /** Platform display name for UI */
  readonly displayName: string

  /** Maximum characters allowed in a post */
  readonly maxTextLength: number

  /** Supported media types */
  readonly supportedMediaTypes: ReadonlyArray<'image' | 'video' | 'carousel'>

  /**
   * Validate stored credentials are still valid
   * Makes an API call to verify token works
   */
  validateCredentials(): Promise<AccountValidationResult>

  /**
   * Refresh expired access token using refresh token
   * Returns new tokens or null if refresh not possible
   */
  refreshAccessToken(): Promise<OAuthTokens | null>

  /**
   * Validate content before posting
   * Checks platform-specific rules (character limits, media requirements, etc.)
   */
  validateContent(content: PostContent): Promise<ContentValidationResult>

  /**
   * Create a new post on the platform
   */
  createPost(content: PostContent): Promise<PostResult>

  /**
   * Upload media to the platform
   * Some platforms require media upload before post creation
   */
  uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult>

  /**
   * Get status of a published post
   */
  getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }>

  /**
   * Delete a published post
   */
  deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }>

  /**
   * Get current rate limit status for main endpoints
   */
  getRateLimitStatus(): Promise<RateLimitInfo[]>
}

/**
 * Constructor type for adapter classes
 */
export type AdapterConstructor = new (
  account: SocialAccount,
  tokens: { accessToken: string; refreshToken: string | null }
) => SocialMediaAdapter

/**
 * Registry for adapter factories
 */
class AdapterRegistryImpl {
  private adapters = new Map<SocialProvider, AdapterConstructor>()

  /**
   * Register an adapter class for a platform
   */
  register(platform: SocialProvider, adapterClass: AdapterConstructor): void {
    this.adapters.set(platform, adapterClass)
  }

  /**
   * Create an adapter instance for a platform
   */
  create(
    platform: SocialProvider,
    account: SocialAccount,
    tokens: { accessToken: string; refreshToken: string | null }
  ): SocialMediaAdapter {
    const AdapterClass = this.adapters.get(platform)

    if (!AdapterClass) {
      throw new Error(`No adapter registered for platform: ${platform}`)
    }

    return new AdapterClass(account, tokens)
  }

  /**
   * Check if a platform is supported
   */
  supports(platform: SocialProvider): boolean {
    return this.adapters.has(platform)
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): SocialProvider[] {
    return Array.from(this.adapters.keys())
  }
}

/** Singleton adapter registry */
export const adapterRegistry = new AdapterRegistryImpl()

/**
 * Base adapter class with common functionality
 * Platform-specific adapters should extend this class
 */
export abstract class BaseAdapter implements SocialMediaAdapter {
  abstract readonly platform: SocialProvider
  abstract readonly displayName: string
  abstract readonly maxTextLength: number
  abstract readonly supportedMediaTypes: ReadonlyArray<'image' | 'video' | 'carousel'>

  protected account: SocialAccount
  protected accessToken: string
  protected refreshToken: string | null

  constructor(
    account: SocialAccount,
    tokens: { accessToken: string; refreshToken: string | null }
  ) {
    this.account = account
    this.accessToken = tokens.accessToken
    this.refreshToken = tokens.refreshToken
  }

  abstract validateCredentials(): Promise<AccountValidationResult>
  abstract refreshAccessToken(): Promise<OAuthTokens | null>
  abstract createPost(content: PostContent): Promise<PostResult>
  abstract uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResult>
  abstract getPostStatus(platformPostId: string): Promise<{
    status: 'published' | 'processing' | 'failed' | 'deleted'
    metrics?: EngagementMetrics
    error?: string
  }>
  abstract deletePost(platformPostId: string): Promise<{
    success: boolean
    error?: string
  }>
  abstract getRateLimitStatus(): Promise<RateLimitInfo[]>

  /**
   * Default content validation implementation
   * Can be overridden by platform-specific adapters
   */
  async validateContent(content: PostContent): Promise<ContentValidationResult> {
    const errors: ContentValidationResult['errors'] = []
    const warnings: ContentValidationResult['warnings'] = []

    // Text length validation
    if (content.text && content.text.length > this.maxTextLength) {
      errors.push({
        field: 'text',
        code: 'TEXT_TOO_LONG',
        message: `テキストは${this.maxTextLength}文字以内にしてください（現在: ${content.text.length}文字）`,
      })
    }

    // Media type validation
    if (content.mediaType && !this.supportedMediaTypes.includes(content.mediaType)) {
      errors.push({
        field: 'mediaType',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `${content.mediaType}はこのプラットフォームでサポートされていません`,
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
   * Helper to check if an error is retryable
   */
  protected isRetryableError(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429
  }

  /**
   * Helper to build authorization header
   */
  protected getAuthHeader(): string {
    return `Bearer ${this.accessToken}`
  }

  /**
   * Helper to handle API errors
   */
  protected handleApiError(
    response: Response,
    defaultMessage: string
  ): PostResult {
    return {
      success: false,
      error: defaultMessage,
      retryable: this.isRetryableError(response.status),
    }
  }
}

/**
 * OAuth configuration for each platform
 */
export const OAUTH_CONFIGS: Record<SocialProvider, {
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  usePKCE: boolean
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  x: {
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    usePKCE: true,
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
  },
  instagram: {
    authorizationUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'pages_show_list',
      'pages_read_engagement',
    ],
    usePKCE: false,
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  youtube: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    usePKCE: true,
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  whatsapp: {
    authorizationUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
    ],
    usePKCE: false,
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
}

/**
 * Get OAuth configuration for a platform
 */
export function getOAuthConfig(platform: SocialProvider) {
  const config = OAUTH_CONFIGS[platform]

  if (!config) {
    throw new Error(`No OAuth config for platform: ${platform}`)
  }

  return {
    ...config,
    clientId: process.env[config.clientIdEnv] || '',
    clientSecret: process.env[config.clientSecretEnv] || '',
  }
}
