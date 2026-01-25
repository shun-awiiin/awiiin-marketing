import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSignedUrl } from '@/lib/bunny/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params
    const supabase = await createClient()

    // Get customer ID from query param or session
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customer_id')

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: '顧客IDが必要です' },
        { status: 400 }
      )
    }

    // Get lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, course_id, bunny_video_id, bunny_library_id, is_preview')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'レッスンが見つかりません' },
        { status: 404 }
      )
    }

    // If preview, allow without enrollment check
    if (!lesson.is_preview) {
      // Check enrollment
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('id, access_status')
        .eq('course_id', lesson.course_id)
        .eq('customer_id', customerId)
        .single()

      if (enrollmentError || !enrollment) {
        return NextResponse.json(
          { success: false, error: 'このコースへのアクセス権がありません' },
          { status: 403 }
        )
      }

      if (enrollment.access_status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'アクセス権が無効です' },
          { status: 403 }
        )
      }
    }

    // Check if video ID exists
    if (!lesson.bunny_video_id) {
      return NextResponse.json(
        { success: false, error: '動画が設定されていません' },
        { status: 400 }
      )
    }

    // Check for existing valid token
    const { data: existingToken } = await supabase
      .from('video_tokens')
      .select('signed_url, expires_at')
      .eq('lesson_id', lessonId)
      .eq('customer_id', customerId)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingToken) {
      return NextResponse.json({
        success: true,
        data: {
          signed_url: existingToken.signed_url,
          expires_at: existingToken.expires_at,
        },
      })
    }

    // Generate new signed URL
    const { embedUrl, expiresAt } = generateSignedUrl(lesson.bunny_video_id, 300)

    // Cache token
    await supabase.from('video_tokens').insert({
      lesson_id: lessonId,
      customer_id: customerId,
      token: embedUrl.split('token=')[1]?.split('&')[0] || '',
      signed_url: embedUrl,
      expires_at: expiresAt.toISOString(),
    })

    return NextResponse.json({
      success: true,
      data: {
        signed_url: embedUrl,
        expires_at: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'トークン生成に失敗しました' },
      { status: 500 }
    )
  }
}
