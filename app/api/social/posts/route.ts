/**
 * Social Posts API
 * GET - List posts
 * POST - Create new post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().min(1, 'コンテンツは必須です'),
  scheduledAt: z.string().datetime().optional().nullable(),
  channels: z.array(z.object({
    accountId: z.string().uuid(),
    config: z.record(z.unknown()).optional(),
  })).min(1, '少なくとも1つのチャンネルを選択してください'),
  status: z.enum(['draft', 'scheduled']).optional().default('draft'),
})

/**
 * GET /api/social/posts
 * List all posts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('social_posts')
      .select(`
        *,
        channels:post_channel_targets(
          id,
          provider,
          status,
          provider_post_id,
          published_at,
          error_message,
          account:social_accounts(
            id,
            provider,
            display_name,
            username,
            profile_image_url
          )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total: count || 0,
        limit,
        offset,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿一覧の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/social/posts
 * Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = createPostSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      )
    }

    const { title, content, scheduledAt, channels, status } = validation.data

    // Verify all accounts belong to user
    const accountIds = channels.map((c) => c.accountId)
    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id, provider, status')
      .eq('user_id', user.id)
      .in('id', accountIds)

    if (accountsError) {
      throw accountsError
    }

    if (!accounts || accounts.length !== accountIds.length) {
      return NextResponse.json(
        { success: false, error: '無効なアカウントが含まれています' },
        { status: 400 }
      )
    }

    // Check for inactive accounts
    const inactiveAccounts = accounts.filter((a) => a.status !== 'active')
    if (inactiveAccounts.length > 0) {
      return NextResponse.json(
        { success: false, error: '無効なアカウントが含まれています。再接続してください。' },
        { status: 400 }
      )
    }

    // Determine final status
    const finalStatus = scheduledAt ? 'scheduled' : status

    // Create post
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: user.id,
        title,
        content,
        scheduled_at: scheduledAt || null,
        status: finalStatus,
      })
      .select()
      .single()

    if (postError) {
      throw postError
    }

    // Create channel targets
    const channelTargets = channels.map((channel) => {
      const account = accounts.find((a) => a.id === channel.accountId)
      return {
        post_id: post.id,
        account_id: channel.accountId,
        provider: account?.provider,
        channel_config: channel.config || {},
        status: finalStatus,
      }
    })

    const { data: targets, error: targetsError } = await supabase
      .from('post_channel_targets')
      .insert(channelTargets)
      .select()

    if (targetsError) {
      // Rollback post creation
      await supabase.from('social_posts').delete().eq('id', post.id)
      throw targetsError
    }

    return NextResponse.json({
      success: true,
      data: {
        ...post,
        channels: targets,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿の作成に失敗しました',
      },
      { status: 500 }
    )
  }
}
