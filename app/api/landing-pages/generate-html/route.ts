import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateLPHTML,
  analyzeReferenceImage,
  refineLPHTML,
} from '@/lib/lp/html-generator'
import { z } from 'zod'

const generateSchema = z.object({
  product_name: z.string().min(1, '商品名は必須です'),
  target_audience: z.string().min(1, 'ターゲットは必須です'),
  main_problem: z.string().min(1, '主な悩み・課題は必須です'),
  solution: z.string().min(1, '解決策は必須です'),
  price: z.string().optional(),
  bonuses: z.array(z.string()).optional(),
  urgency: z.string().optional(),
  testimonials: z
    .array(
      z.object({
        name: z.string(),
        quote: z.string(),
      })
    )
    .optional(),
  // 参考画像（Base64）
  referenceImage: z.string().optional(),
  referenceImageMimeType: z.string().optional(),
})

const refineSchema = z.object({
  current_html: z.string(),
  current_css: z.string(),
  instruction: z.string().min(1, '修正指示は必須です'),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // リファインリクエストの場合
    if (body.current_html && body.instruction) {
      const validation = refineSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        )
      }

      const result = await refineLPHTML(
        validation.data.current_html,
        validation.data.current_css,
        validation.data.instruction
      )

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    // 新規生成リクエスト
    const validation = generateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    let imageAnalysis = null

    // 参考画像がある場合は先に分析
    if (validation.data.referenceImage && validation.data.referenceImageMimeType) {
      imageAnalysis = await analyzeReferenceImage(
        validation.data.referenceImage,
        validation.data.referenceImageMimeType
      )
    }

    // HTML生成
    const result = await generateLPHTML(validation.data, imageAnalysis)

    // 生成履歴を保存
    await supabase.from('lp_generation_history').insert({
      user_id: user.id,
      prompt: JSON.stringify({
        ...validation.data,
        referenceImage: validation.data.referenceImage ? '[BASE64_IMAGE]' : undefined,
        imageAnalysis,
      }),
      generated_blocks: { html: result.html, css: result.css },
    })

    return NextResponse.json({
      success: true,
      data: {
        html: result.html,
        css: result.css,
        title: result.title,
        meta_description: result.meta_description,
        imageAnalysis,
      },
    })
  } catch (error) {
    console.error('LP HTML generation error:', error)
    return NextResponse.json(
      { success: false, error: 'LP生成に失敗しました' },
      { status: 500 }
    )
  }
}
