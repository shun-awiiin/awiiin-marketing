/**
 * Publish Post API
 * POST - Immediately publish a post to all channels
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishToChannels } from '@/lib/social/social-sender'
import type { PostContent } from '@/lib/social/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/social/posts/[id]/publish
 * Immediately publish a post to all its channel targets
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    // Get post with channels
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select(`
        *,
        channels:post_channel_targets(
          id,
          account_id,
          provider,
          status,
          channel_config
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: '投稿が見つかりません' },
        { status: 404 }
      )
    }

    // Check if already published
    if (post.status === 'published') {
      return NextResponse.json(
        { success: false, error: 'この投稿は既に公開されています' },
        { status: 400 }
      )
    }

    // Check if cancelled
    if (post.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'キャンセルされた投稿は公開できません' },
        { status: 400 }
      )
    }

    // Filter channels that can be published
    const publishableChannels = post.channels.filter(
      (ch: { status: string }) => ['draft', 'scheduled', 'failed'].includes(ch.status)
    )

    if (publishableChannels.length === 0) {
      return NextResponse.json(
        { success: false, error: '公開可能なチャンネルがありません' },
        { status: 400 }
      )
    }

    // Build content for each channel
    const channelTargets = publishableChannels.map((channel: {
      id: string
      account_id: string
      channel_config: Record<string, unknown>
    }) => {
      const content: PostContent = {
        text: post.content,
        platformOptions: channel.channel_config as PostContent['platformOptions'],
      }

      return {
        id: channel.id,
        accountId: channel.account_id,
        content,
      }
    })

    // Publish to all channels
    const result = await publishToChannels(id, channelTargets)

    return NextResponse.json({
      success: true,
      data: {
        postId: id,
        allSuccessful: result.allSuccessful,
        results: result.results.map((r) => ({
          channelTargetId: r.channelTargetId,
          success: r.success,
          platformPostId: r.platformPostId,
          platformUrl: r.platformUrl,
          error: r.error,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿の公開に失敗しました',
      },
      { status: 500 }
    )
  }
}
