import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateLPHTML,
  analyzeReferenceImage,
  editSection,
  generateSection,
  generateAdvancedLP,
  type LPSection,
  type LPGenerationInput,
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
  // 4段階高品質生成モード
  advancedMode: z.boolean().optional(),
  // 追加フィールド
  brand_keywords: z.array(z.string()).optional(),
  key_features: z.array(z.string()).optional(),
  desired_action: z.string().optional(),
})

// セクション編集スキーマ
const editSectionSchema = z.object({
  section: z.object({
    id: z.string(),
    type: z.string(),
    html: z.string(),
    order: z.number(),
  }),
  instruction: z.string().min(1, '編集指示は必須です'),
  input: generateSchema.partial(),
})

// セクション再生成スキーマ
const regenerateSectionSchema = z.object({
  sectionType: z.string(),
  customInstruction: z.string().optional(),
  input: generateSchema.partial(),
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

    // セクション編集リクエスト
    if (body.section && body.instruction) {
      const validation = editSectionSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        )
      }

      const input = validation.data.input as LPGenerationInput
      const result = await editSection(
        validation.data.section as LPSection,
        validation.data.instruction,
        input
      )

      return NextResponse.json({
        success: true,
        data: { section: result },
      })
    }

    // セクション再生成リクエスト
    if (body.sectionType && body.input) {
      const validation = regenerateSectionSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        )
      }

      const input = validation.data.input as LPGenerationInput
      const result = await generateSection(
        validation.data.sectionType,
        input,
        validation.data.customInstruction
      )

      return NextResponse.json({
        success: true,
        data: { section: result },
      })
    }

    // 新規LP生成リクエスト
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

    // LP生成（通常モード or 4段階高品質モード）
    let result
    let deepAnalysis = null
    let designConcept = null

    if (validation.data.advancedMode) {
      // 4段階高品質LP生成
      const advancedResult = await generateAdvancedLP(
        validation.data as LPGenerationInput,
        imageAnalysis
      )
      result = advancedResult
      deepAnalysis = advancedResult.deepAnalysis || null
      designConcept = advancedResult.designConcept || null
    } else {
      // 通常のセクションベースLP生成
      result = await generateLPHTML(validation.data, imageAnalysis)
    }

    // 生成履歴を保存
    await supabase.from('lp_generation_history').insert({
      user_id: user.id,
      prompt: JSON.stringify({
        ...validation.data,
        referenceImage: validation.data.referenceImage ? '[BASE64_IMAGE]' : undefined,
        imageAnalysis,
      }),
      generated_blocks: { sections: result.sections, globalCss: result.globalCss },
    })

    return NextResponse.json({
      success: true,
      data: {
        sections: result.sections,
        globalCss: result.globalCss,
        title: result.title,
        meta_description: result.meta_description,
        imageAnalysis,
        deepAnalysis,
        designConcept,
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
