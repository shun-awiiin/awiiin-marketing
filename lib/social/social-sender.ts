/**
 * Social Sender Service
 * Unified publishing service for all social media platforms
 */

import { createServiceClient } from '@/lib/supabase/server'
import { adapterRegistry } from './adapters/interface'
import { getAccountWithTokens, updateAccountTokens, updateAccountStatus } from './oauth/token-storage'
import type {
  SocialProvider,
  PostContent,
  PostResult,
  SocialAccountWithTokens,
  ContentValidationResult,
  PostChannelTarget,
} from './types'

// Import adapters to register them
import './adapters/x-adapter'
import './adapters/instagram-adapter'
import './adapters/youtube-adapter'
import './adapters/whatsapp-adapter'

interface PublishRequest {
  postId: string
  channelTargetId: string
  accountId: string
  content: PostContent
}

interface PublishResult {
  channelTargetId: string
  success: boolean
  platformPostId?: string
  platformUrl?: string
  error?: string
  retryable?: boolean
}

interface BatchPublishResult {
  postId: string
  results: PublishResult[]
  allSuccessful: boolean
}

/**
 * Publish content to a single channel
 */
export async function publishToChannel(request: PublishRequest): Promise<PublishResult> {
  const supabase = await createServiceClient()

  try {
    // Get account with tokens
    const account = await getAccountWithTokens(request.accountId)

    if (!account) {
      return {
        channelTargetId: request.channelTargetId,
        success: false,
        error: 'アカウントが見つかりません',
        retryable: false,
      }
    }

    if (account.status !== 'active') {
      return {
        channelTargetId: request.channelTargetId,
        success: false,
        error: `アカウントが無効です（ステータス: ${account.status}）`,
        retryable: false,
      }
    }

    // Check if adapter is available
    if (!adapterRegistry.supports(account.provider)) {
      return {
        channelTargetId: request.channelTargetId,
        success: false,
        error: `${account.provider}はまだサポートされていません`,
        retryable: false,
      }
    }

    // Create adapter
    const adapter = adapterRegistry.create(account.provider, account, {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    })

    // Validate content
    const validation = await adapter.validateContent(request.content)
    if (!validation.valid) {
      return {
        channelTargetId: request.channelTargetId,
        success: false,
        error: validation.errors.map((e) => e.message).join(', '),
        retryable: false,
      }
    }

    // Update channel target status to publishing
    await supabase
      .from('post_channel_targets')
      .update({
        status: 'publishing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.channelTargetId)

    // Publish content
    const result = await adapter.createPost(
      validation.sanitizedContent || request.content
    )

    // Update channel target with result
    if (result.success) {
      await supabase
        .from('post_channel_targets')
        .update({
          status: 'published',
          provider_post_id: result.platformPostId,
          published_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.channelTargetId)

      // Log success event
      await logSocialEvent(supabase, {
        userId: account.userId,
        accountId: account.id,
        postId: request.postId,
        channelTargetId: request.channelTargetId,
        provider: account.provider,
        eventType: 'post_published',
        payload: {
          platformPostId: result.platformPostId,
          platformUrl: result.platformUrl,
        },
      })
    } else {
      const retryCount = await incrementRetryCount(supabase, request.channelTargetId)

      await supabase
        .from('post_channel_targets')
        .update({
          status: result.retryable && retryCount < 3 ? 'scheduled' : 'failed',
          error_message: result.error,
          next_retry_at: result.retryable && retryCount < 3
            ? new Date(Date.now() + getRetryDelay(retryCount)).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.channelTargetId)

      // Log failure event
      await logSocialEvent(supabase, {
        userId: account.userId,
        accountId: account.id,
        postId: request.postId,
        channelTargetId: request.channelTargetId,
        provider: account.provider,
        eventType: 'post_failed',
        payload: {
          error: result.error,
          retryable: result.retryable,
          retryCount,
        },
      })

      // Check if token needs refresh
      if (result.error?.includes('token') || result.error?.includes('認証')) {
        await handleTokenRefresh(account, adapter)
      }
    }

    return {
      channelTargetId: request.channelTargetId,
      success: result.success,
      platformPostId: result.platformPostId,
      platformUrl: result.platformUrl,
      error: result.error,
      retryable: result.retryable,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '投稿中にエラーが発生しました'

    await supabase
      .from('post_channel_targets')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.channelTargetId)

    return {
      channelTargetId: request.channelTargetId,
      success: false,
      error: errorMessage,
      retryable: true,
    }
  }
}

/**
 * Publish to multiple channels
 */
export async function publishToChannels(
  postId: string,
  channelTargets: Array<{
    id: string
    accountId: string
    content: PostContent
  }>
): Promise<BatchPublishResult> {
  const results = await Promise.all(
    channelTargets.map((target) =>
      publishToChannel({
        postId,
        channelTargetId: target.id,
        accountId: target.accountId,
        content: target.content,
      })
    )
  )

  const allSuccessful = results.every((r) => r.success)

  // Update post status
  const supabase = await createServiceClient()
  await supabase
    .from('social_posts')
    .update({
      status: allSuccessful ? 'published' : 'failed',
      published_at: allSuccessful ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  return {
    postId,
    results,
    allSuccessful,
  }
}

/**
 * Validate content for multiple platforms
 */
export async function validateContentForPlatforms(
  content: PostContent,
  platforms: SocialProvider[]
): Promise<Record<SocialProvider, ContentValidationResult>> {
  const results: Record<string, ContentValidationResult> = {}

  for (const platform of platforms) {
    if (!adapterRegistry.supports(platform)) {
      results[platform] = {
        valid: false,
        errors: [{ field: 'platform', code: 'UNSUPPORTED', message: `${platform}はサポートされていません` }],
        warnings: [],
      }
      continue
    }

    // Create a dummy adapter for validation
    const dummyAccount = {
      id: '',
      userId: '',
      provider: platform,
      providerAccountId: '',
      displayName: null,
      username: null,
      profileImageUrl: null,
      scopes: [],
      status: 'active' as const,
      tokenExpiresAt: null,
      lastValidatedAt: null,
      errorMessage: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const adapter = adapterRegistry.create(platform, dummyAccount, {
      accessToken: '',
      refreshToken: null,
    })

    results[platform] = await adapter.validateContent(content)
  }

  return results as Record<SocialProvider, ContentValidationResult>
}

/**
 * Handle token refresh for an account
 */
async function handleTokenRefresh(
  account: SocialAccountWithTokens,
  adapter: ReturnType<typeof adapterRegistry.create>
): Promise<void> {
  try {
    const newTokens = await adapter.refreshAccessToken()

    if (newTokens) {
      await updateAccountTokens(account.id, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
      })
    } else {
      await updateAccountStatus(account.id, 'expired', 'トークンの更新に失敗しました')
    }
  } catch {
    await updateAccountStatus(account.id, 'expired', 'トークンの更新中にエラーが発生しました')
  }
}

/**
 * Increment retry count and return new count
 */
async function incrementRetryCount(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  channelTargetId: string
): Promise<number> {
  const { data } = await supabase
    .from('post_channel_targets')
    .select('retry_count')
    .eq('id', channelTargetId)
    .single()

  const currentCount = data?.retry_count || 0
  const newCount = currentCount + 1

  await supabase
    .from('post_channel_targets')
    .update({ retry_count: newCount })
    .eq('id', channelTargetId)

  return newCount
}

/**
 * Get retry delay based on retry count (exponential backoff)
 */
function getRetryDelay(retryCount: number): number {
  const baseDelay = 60 * 1000 // 1 minute
  return baseDelay * Math.pow(2, retryCount)
}

/**
 * Log a social event
 */
async function logSocialEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: {
    userId: string
    accountId: string
    postId: string
    channelTargetId: string
    provider: SocialProvider
    eventType: string
    payload: Record<string, unknown>
  }
): Promise<void> {
  await supabase.from('social_events').insert({
    user_id: event.userId,
    account_id: event.accountId,
    post_id: event.postId,
    channel_target_id: event.channelTargetId,
    provider: event.provider,
    event_type: event.eventType,
    payload: event.payload,
    occurred_at: new Date().toISOString(),
  })
}

/**
 * Get post with all channel targets
 */
export async function getPostWithChannels(postId: string, userId: string) {
  const supabase = await createServiceClient()

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', userId)
    .single()

  if (postError || !post) {
    return null
  }

  const { data: channels } = await supabase
    .from('post_channel_targets')
    .select(`
      *,
      account:social_accounts(
        id,
        provider,
        display_name,
        username,
        profile_image_url,
        status
      )
    `)
    .eq('post_id', postId)

  return {
    ...post,
    channels: channels || [],
  }
}
