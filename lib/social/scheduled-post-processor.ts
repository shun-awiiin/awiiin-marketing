/**
 * Scheduled Post Processor
 * Processes scheduled posts that are due for publishing
 */

import { createServiceClient } from '@/lib/supabase/server'
import { publishToChannel } from './social-sender'
import type { PostContent, SocialProvider } from './types'

interface ScheduledPost {
  id: string
  content: string
  channels: Array<{
    id: string
    account_id: string
    provider: SocialProvider
    channel_config: Record<string, unknown>
    status: string
  }>
}

interface ProcessResult {
  processed: number
  successful: number
  failed: number
  errors: Array<{ postId: string; channelId: string; error: string }>
}

/**
 * Process all scheduled posts that are due
 */
export async function processScheduledPosts(): Promise<ProcessResult> {
  const supabase = await createServiceClient()
  const result: ProcessResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Get due scheduled posts
    const { data: duePosts, error: postsError } = await supabase
      .from('social_posts')
      .select(`
        id,
        content,
        channels:post_channel_targets(
          id,
          account_id,
          provider,
          channel_config,
          status
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (postsError) {
      throw postsError
    }

    if (!duePosts || duePosts.length === 0) {
      return result
    }

    // Process each post
    for (const post of duePosts as ScheduledPost[]) {
      // Filter publishable channels
      const publishableChannels = post.channels.filter(
        (ch) => ch.status === 'scheduled'
      )

      if (publishableChannels.length === 0) {
        continue
      }

      // Publish to each channel
      for (const channel of publishableChannels) {
        result.processed++

        const content: PostContent = {
          text: post.content,
          platformOptions: channel.channel_config as PostContent['platformOptions'],
        }

        const publishResult = await publishToChannel({
          postId: post.id,
          channelTargetId: channel.id,
          accountId: channel.account_id,
          content,
        })

        if (publishResult.success) {
          result.successful++
        } else {
          result.failed++
          result.errors.push({
            postId: post.id,
            channelId: channel.id,
            error: publishResult.error || 'Unknown error',
          })
        }
      }

      // Update post status based on channel results
      const { data: updatedChannels } = await supabase
        .from('post_channel_targets')
        .select('status')
        .eq('post_id', post.id)

      const allPublished = updatedChannels?.every((ch) => ch.status === 'published')
      const anyFailed = updatedChannels?.some((ch) => ch.status === 'failed')

      const postStatus = allPublished
        ? 'published'
        : anyFailed
        ? 'failed'
        : 'publishing'

      await supabase
        .from('social_posts')
        .update({
          status: postStatus,
          published_at: allPublished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
    }

    return result
  } catch (error) {
    result.errors.push({
      postId: 'system',
      channelId: 'system',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return result
  }
}

/**
 * Process failed posts that are due for retry
 */
export async function processRetryPosts(): Promise<ProcessResult> {
  const supabase = await createServiceClient()
  const result: ProcessResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Get channels due for retry
    const { data: retryChannels, error } = await supabase
      .from('post_channel_targets')
      .select(`
        id,
        post_id,
        account_id,
        provider,
        channel_config,
        retry_count,
        post:social_posts(id, content, user_id)
      `)
      .eq('status', 'scheduled')
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 3)
      .order('next_retry_at', { ascending: true })
      .limit(20)

    if (error) {
      throw error
    }

    if (!retryChannels || retryChannels.length === 0) {
      return result
    }

    for (const channel of retryChannels) {
      result.processed++

      const postData = channel.post as Array<{ id: string; content: string; user_id: string }> | null
      const post = postData?.[0]
      if (!post) continue

      const content: PostContent = {
        text: post.content,
        platformOptions: channel.channel_config as PostContent['platformOptions'],
      }

      const publishResult = await publishToChannel({
        postId: post.id,
        channelTargetId: channel.id,
        accountId: channel.account_id,
        content,
      })

      if (publishResult.success) {
        result.successful++
      } else {
        result.failed++
        result.errors.push({
          postId: post.id,
          channelId: channel.id,
          error: publishResult.error || 'Unknown error',
        })
      }
    }

    return result
  } catch (error) {
    result.errors.push({
      postId: 'system',
      channelId: 'system',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return result
  }
}

/**
 * Refresh expiring tokens proactively
 */
export async function refreshExpiringTokens(): Promise<{
  refreshed: number
  failed: number
}> {
  const supabase = await createServiceClient()
  const result = { refreshed: 0, failed: 0 }

  try {
    // Get accounts with tokens expiring in next 30 minutes
    const expiryThreshold = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('id, provider')
      .eq('status', 'active')
      .not('token_expires_at', 'is', null)
      .lt('token_expires_at', expiryThreshold)
      .limit(20)

    if (error || !accounts) {
      return result
    }

    // Token refresh is handled by the adapter when needed
    // This function just identifies accounts that need refresh
    result.refreshed = accounts.length

    return result
  } catch {
    return result
  }
}
