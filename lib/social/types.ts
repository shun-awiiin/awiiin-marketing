/**
 * Social Media Types
 * Unified type definitions for X, Instagram, YouTube, WhatsApp integration
 */

// ============================================
// CORE TYPES
// ============================================

export type SocialProvider = 'x' | 'instagram' | 'youtube' | 'whatsapp'

export type SocialAccountStatus = 'active' | 'inactive' | 'expired' | 'revoked'

export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export type SocialAssetType = 'image' | 'video' | 'carousel'

export type SocialAssetStatus = 'uploading' | 'processing' | 'ready' | 'failed'

// ============================================
// PLATFORM LIMITS
// ============================================

export interface PlatformLimits {
  maxTextLength: number
  maxImages?: number
  maxVideos?: number
  maxVideoLengthSeconds?: number
  maxVideoSizeMB?: number
  supportedImageFormats?: string[]
  supportedVideoFormats?: string[]
  maxUrlsPerPost?: number
  maxHashtags?: number
  maxTitleLength?: number
  maxDescriptionLength?: number
  maxTags?: number
}

export const PLATFORM_LIMITS: Record<SocialProvider, PlatformLimits> = {
  x: {
    maxTextLength: 280,
    maxImages: 4,
    maxVideos: 1,
    maxVideoLengthSeconds: 140,
    maxVideoSizeMB: 512,
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    supportedVideoFormats: ['mp4', 'mov'],
    maxUrlsPerPost: 1,
  },
  instagram: {
    maxTextLength: 2200,
    maxImages: 10,
    maxVideos: 1,
    maxVideoLengthSeconds: 90,
    maxVideoSizeMB: 100,
    supportedImageFormats: ['jpg', 'jpeg', 'png'],
    supportedVideoFormats: ['mp4', 'mov'],
    maxHashtags: 30,
  },
  youtube: {
    maxTextLength: 5000,
    maxTitleLength: 100,
    maxDescriptionLength: 5000,
    maxVideoLengthSeconds: 43200,
    maxVideoSizeMB: 256000,
    supportedVideoFormats: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    maxTags: 500,
  },
  whatsapp: {
    maxTextLength: 4096,
    maxImages: 1,
    maxVideos: 1,
    maxVideoLengthSeconds: 120,
    supportedImageFormats: ['jpg', 'jpeg', 'png'],
    supportedVideoFormats: ['mp4'],
  },
}

// ============================================
// OAUTH TYPES
// ============================================

export interface OAuthConfig {
  platform: SocialProvider
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  usePKCE: boolean
}

export interface OAuthState {
  id: string
  userId: string
  platform: SocialProvider
  state: string
  codeVerifier?: string
  redirectUri: string
  expiresAt: Date
  createdAt: Date
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes: string[]
}

export interface TokenExchangeResult {
  success: boolean
  tokens?: OAuthTokens
  platformAccountId?: string
  platformData?: Record<string, unknown>
  error?: string
}

// ============================================
// ACCOUNT TYPES
// ============================================

export interface SocialAccount {
  id: string
  userId: string
  provider: SocialProvider
  providerAccountId: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  scopes: string[]
  status: SocialAccountStatus
  tokenExpiresAt: Date | null
  lastValidatedAt: Date | null
  errorMessage: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface SocialAccountWithTokens extends SocialAccount {
  accessToken: string
  refreshToken: string | null
}

// ============================================
// POST CONTENT TYPES
// ============================================

export interface PostContent {
  text?: string
  mediaUrls?: string[]
  mediaType?: SocialAssetType
  platformOptions?: PlatformPostOptions
}

export interface PlatformPostOptions {
  x?: XPostOptions
  instagram?: InstagramPostOptions
  youtube?: YouTubePostOptions
  whatsapp?: WhatsAppPostOptions
}

export interface XPostOptions {
  threadMode?: boolean
  replyTo?: string
  quotePost?: string
  replySettings?: 'everyone' | 'following' | 'mentioned'
  pollOptions?: string[]
  pollDurationMinutes?: number
}

export interface InstagramPostOptions {
  caption?: string
  locationId?: string
  userTags?: Array<{
    username: string
    x: number
    y: number
  }>
  firstComment?: string
  shareToFeed?: boolean
  isReel?: boolean
}

export interface YouTubePostOptions {
  title: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacyStatus: 'public' | 'private' | 'unlisted'
  scheduledStartTime?: Date
  thumbnailUrl?: string
  playlistId?: string
}

export interface WhatsAppPostOptions {
  templateName: string
  templateLanguage: string
  templateComponents?: TemplateComponent[]
  contactIds: string[]
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  subType?: 'quick_reply' | 'url'
  index?: number
  parameters: TemplateParameter[]
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video'
  text?: string
  currency?: {
    fallbackValue: string
    code: string
    amount1000: number
  }
  dateTime?: {
    fallbackValue: string
  }
  image?: {
    link: string
  }
  document?: {
    link: string
    filename?: string
  }
  video?: {
    link: string
  }
}

// ============================================
// RESULT TYPES
// ============================================

export interface PostResult {
  success: boolean
  platformPostId?: string
  platformUrl?: string
  error?: string
  retryable?: boolean
}

export interface MediaUploadResult {
  success: boolean
  mediaId?: string
  mediaUrl?: string
  error?: string
}

export interface RateLimitInfo {
  endpoint: string
  remaining: number
  limit: number
  resetAt: Date
  windowSeconds: number
}

export interface AccountValidationResult {
  valid: boolean
  error?: string
  accountInfo?: {
    displayName: string
    username: string
    profileImageUrl?: string
  }
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ContentValidationResult {
  valid: boolean
  errors: ContentValidationError[]
  warnings: ContentValidationWarning[]
  sanitizedContent?: PostContent
}

export interface ContentValidationError {
  field: string
  code: string
  message: string
}

export interface ContentValidationWarning {
  field: string
  code: string
  message: string
  suggestion?: string
}

// ============================================
// POST & ASSET TYPES
// ============================================

export interface SocialPost {
  id: string
  userId: string
  title: string | null
  content: string
  scheduledAt: Date | null
  publishedAt: Date | null
  status: SocialPostStatus
  createdAt: Date
  updatedAt: Date
}

export interface PostChannelTarget {
  id: string
  postId: string
  accountId: string
  provider: SocialProvider
  channelConfig: Record<string, unknown>
  providerPostId: string | null
  status: SocialPostStatus
  publishedAt: Date | null
  errorMessage: string | null
  retryCount: number
  nextRetryAt: Date | null
  engagementData: EngagementMetrics
  createdAt: Date
  updatedAt: Date
}

export interface SocialAsset {
  id: string
  userId: string
  postId: string | null
  assetType: SocialAssetType
  fileName: string
  fileSize: number
  mimeType: string
  storagePath: string
  cdnUrl: string | null
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  status: SocialAssetStatus
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface EngagementMetrics {
  views?: number
  likes?: number
  comments?: number
  shares?: number
  impressions?: number
  clicks?: number
  saves?: number
  reach?: number
}

// ============================================
// EVENT TYPES
// ============================================

export type SocialEventType =
  | 'account_connected'
  | 'account_disconnected'
  | 'account_expired'
  | 'post_created'
  | 'post_scheduled'
  | 'post_publishing'
  | 'post_published'
  | 'post_failed'
  | 'post_deleted'
  | 'engagement_updated'
  | 'webhook_received'

export interface SocialEvent {
  id: string
  userId: string | null
  accountId: string | null
  postId: string | null
  channelTargetId: string | null
  provider: SocialProvider
  eventType: SocialEventType
  providerEventId: string | null
  payload: Record<string, unknown>
  occurredAt: Date
  createdAt: Date
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreatePostRequest {
  title?: string
  content: string
  scheduledAt?: string
  channels: Array<{
    accountId: string
    config?: Record<string, unknown>
  }>
  assetIds?: string[]
}

export interface UpdatePostRequest {
  title?: string
  content?: string
  scheduledAt?: string | null
  status?: 'draft' | 'scheduled' | 'cancelled'
}

export interface SocialPostResponse {
  success: boolean
  data?: SocialPost & {
    channels: PostChannelTarget[]
    assets: SocialAsset[]
  }
  error?: string
}

export interface SocialAccountResponse {
  success: boolean
  data?: Omit<SocialAccount, 'accessToken' | 'refreshToken'>
  error?: string
}
