import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLPContent, refineLPContent } from '@/lib/lp/ai-generator'
import { z } from 'zod'

const generateSchema = z.object({
  product_name: z.string().min(1, '商品名は必須です'),
  target_audience: z.string().min(1, 'ターゲットは必須です'),
  main_problem: z.string().min(1, '主な悩み・課題は必須です'),
  solution: z.string().min(1, '解決策は必須です'),
  price: z.string().optional(),
  bonuses: z.array(z.string()).optional(),
  urgency: z.string().optional(),
  testimonials: z.array(z.object({
    name: z.string(),
    quote: z.string(),
  })).optional(),
})

const refineSchema = z.object({
  current_blocks: z.array(z.unknown()),
  instruction: z.string().min(1, '指示は必須です'),
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

    // Check if this is a refinement request
    if (body.current_blocks && body.instruction) {
      const validation = refineSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        )
      }

      const blocks = await refineLPContent(
        validation.data.current_blocks as Parameters<typeof refineLPContent>[0],
        validation.data.instruction
      )

      return NextResponse.json({
        success: true,
        data: { blocks },
      })
    }

    // Generate new LP
    const validation = generateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const blocks = await generateLPContent(validation.data)

    // Save generation history
    await supabase.from('lp_generation_history').insert({
      user_id: user.id,
      prompt: JSON.stringify(validation.data),
      generated_blocks: blocks,
    })

    return NextResponse.json({
      success: true,
      data: { blocks },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'LP生成に失敗しました' },
      { status: 500 }
    )
  }
}
