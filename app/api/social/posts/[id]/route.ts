/**
 * Individual Post API
 * GET - Get post details
 * PATCH - Update post
 * DELETE - Delete post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updatePostSchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'cancelled']).optional(),
})

/**
 * GET /api/social/posts/[id]
 * Get post details with channel targets
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { data: post, error } = await supabase
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
          retry_count,
          engagement_data,
          channel_config,
          account:social_accounts(
            id,
            provider,
            display_name,
            username,
            profile_image_url,
            status
          )
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !post) {
      return NextResponse.json(
        { success: false, error: '投稿が見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/social/posts/[id]
 * Update a post
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Verify ownership and status
    const { data: existingPost } = await supabase
      .from('social_posts')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: '投稿が見つかりません' },
        { status: 404 }
      )
    }

    // Cannot edit published posts
    if (existingPost.status === 'published') {
      return NextResponse.json(
        { success: false, error: '公開済みの投稿は編集できません' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = updatePostSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      )
    }

    const { title, content, scheduledAt, status } = validation.data

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (scheduledAt !== undefined) updateData.scheduled_at = scheduledAt
    if (status !== undefined) updateData.status = status

    // If scheduling, update status to scheduled
    if (scheduledAt && !status) {
      updateData.status = 'scheduled'
    }

    const { data: post, error } = await supabase
      .from('social_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update channel target statuses if post status changed
    if (status) {
      await supabase
        .from('post_channel_targets')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('post_id', id)
        .in('status', ['draft', 'scheduled'])
    }

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿の更新に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/social/posts/[id]
 * Delete a post
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Verify ownership
    const { data: existingPost } = await supabase
      .from('social_posts')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: '投稿が見つかりません' },
        { status: 404 }
      )
    }

    // Delete post (cascade will handle channel targets)
    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '投稿の削除に失敗しました',
      },
      { status: 500 }
    )
  }
}
