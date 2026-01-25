import Anthropic from '@anthropic-ai/sdk'
import type { LPBlock, LPGenerationInput, BlockType } from '@/lib/types/landing-page'

const SYSTEM_PROMPT = `You are an expert landing page copywriter. Your task is to generate compelling landing page content in JSON format.

You MUST output ONLY valid JSON that matches this exact schema:
{
  "blocks": [
    {
      "id": "uuid-string",
      "type": "hero|problem|solution|features|testimonials|pricing|bonus|faq|cta|form|video|countdown",
      "content": { ... block-specific content ... },
      "settings": { "padding": "medium", "width": "medium" }
    }
  ]
}

Block types and their required content:

1. hero: { "headline": "string", "subheadline": "string", "cta_text": "string", "cta_url": "#form" }
2. problem: { "title": "string", "problems": ["string", "string", ...] }
3. solution: { "title": "string", "description": "string", "bullets": ["string", ...] }
4. features: { "title": "string", "features": [{ "title": "string", "description": "string" }, ...] }
5. testimonials: { "title": "string", "items": [{ "name": "string", "quote": "string", "role": "string" }, ...] }
6. pricing: { "title": "string", "plans": [{ "name": "string", "price": "string", "features": ["string"], "cta_text": "string", "cta_url": "#form" }] }
7. bonus: { "title": "string", "bonuses": [{ "title": "string", "value": "string", "description": "string" }, ...] }
8. faq: { "title": "string", "items": [{ "question": "string", "answer": "string" }, ...] }
9. cta: { "title": "string", "description": "string", "button_text": "string", "button_url": "#form" }
10. form: { "title": "string", "fields": [{ "name": "email", "label": "string", "type": "email", "required": true }], "submit_text": "string" }

Guidelines:
- Write in Japanese
- Be persuasive and benefit-focused
- Use emotional triggers
- Keep sentences concise
- Include urgency when appropriate
- Generate 6-10 blocks typically`

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function generateLPContent(input: LPGenerationInput): Promise<LPBlock[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    // Return default template if API key not configured
    return generateDefaultTemplate(input)
  }

  const anthropic = new Anthropic({ apiKey })

  const userPrompt = `Create a landing page for:

Product/Service: ${input.product_name}
Target Audience: ${input.target_audience}
Main Problem: ${input.main_problem}
Solution: ${input.solution}
${input.price ? `Price: ${input.price}` : ''}
${input.bonuses?.length ? `Bonuses: ${input.bonuses.join(', ')}` : ''}
${input.urgency ? `Urgency: ${input.urgency}` : ''}
${input.testimonials?.length ? `Testimonials: ${input.testimonials.map(t => `${t.name}: "${t.quote}"`).join('; ')}` : ''}

Generate a complete, compelling landing page with appropriate blocks.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and ensure UUIDs
    const blocks: LPBlock[] = parsed.blocks.map((block: Partial<LPBlock>) => ({
      id: block.id || generateUUID(),
      type: block.type as BlockType,
      content: block.content || {},
      settings: block.settings || { padding: 'medium', width: 'medium' },
    }))

    return blocks
  } catch (error) {
    // Fall back to template on error
    return generateDefaultTemplate(input)
  }
}

function generateDefaultTemplate(input: LPGenerationInput): LPBlock[] {
  const blocks: LPBlock[] = [
    {
      id: generateUUID(),
      type: 'hero',
      content: {
        headline: input.product_name,
        subheadline: input.solution,
        cta_text: '今すぐ申し込む',
        cta_url: '#form',
      },
      settings: { padding: 'large', width: 'full' },
    },
    {
      id: generateUUID(),
      type: 'problem',
      content: {
        title: 'こんなお悩みありませんか？',
        problems: [
          input.main_problem,
          '解決方法が分からない',
          '時間がかかりすぎる',
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
    {
      id: generateUUID(),
      type: 'solution',
      content: {
        title: 'その悩み、解決できます',
        description: input.solution,
        bullets: [
          '簡単に始められる',
          '確実に結果が出る',
          'サポート体制も万全',
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
    {
      id: generateUUID(),
      type: 'features',
      content: {
        title: '選ばれる3つの理由',
        features: [
          { title: '理由1', description: '詳細な説明' },
          { title: '理由2', description: '詳細な説明' },
          { title: '理由3', description: '詳細な説明' },
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
  ]

  // Add testimonials if provided
  if (input.testimonials?.length) {
    blocks.push({
      id: generateUUID(),
      type: 'testimonials',
      content: {
        title: 'お客様の声',
        items: input.testimonials.map((t) => ({
          name: t.name,
          quote: t.quote,
          role: '',
        })),
      },
      settings: { padding: 'medium', width: 'medium' },
    })
  }

  // Add pricing if provided
  if (input.price) {
    blocks.push({
      id: generateUUID(),
      type: 'pricing',
      content: {
        title: '料金プラン',
        plans: [
          {
            name: 'スタンダード',
            price: input.price,
            features: ['基本機能すべて', 'サポート付き'],
            cta_text: '申し込む',
            cta_url: '#form',
          },
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    })
  }

  // Add bonuses if provided
  if (input.bonuses?.length) {
    blocks.push({
      id: generateUUID(),
      type: 'bonus',
      content: {
        title: '今だけの特典',
        bonuses: input.bonuses.map((b, i) => ({
          title: `特典${i + 1}`,
          value: '',
          description: b,
        })),
      },
      settings: { padding: 'medium', width: 'medium' },
    })
  }

  // Add form
  blocks.push({
    id: generateUUID(),
    type: 'form',
    content: {
      title: '今すぐお申し込み',
      fields: [
        { name: 'name', label: 'お名前', type: 'text', required: true },
        { name: 'email', label: 'メールアドレス', type: 'email', required: true },
      ],
      submit_text: '申し込む',
    },
    settings: { padding: 'large', width: 'narrow' },
  })

  return blocks
}

export async function refineLPContent(
  currentBlocks: LPBlock[],
  instruction: string
): Promise<LPBlock[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    // Return unchanged if API key not configured
    return currentBlocks
  }

  const anthropic = new Anthropic({ apiKey })

  const userPrompt = `Current landing page blocks:
${JSON.stringify(currentBlocks, null, 2)}

User instruction: ${instruction}

Update the blocks according to the instruction. Output the complete updated blocks array in JSON format.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return currentBlocks
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return currentBlocks
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.blocks as LPBlock[]
  } catch {
    return currentBlocks
  }
}

// Copy-paste prompt template for users
export const LP_GENERATION_PROMPT_TEMPLATE = `以下の情報を入力してください：

1. 商品/サービス名：
2. ターゲット（誰向け）：
3. 主な悩み/課題：
4. 提供する解決策：
5. 価格：
6. 特典/ボーナス：
7. 限定性（期間/人数）：
8. お客様の声（任意）：

---

例：

1. 商品/サービス名：オンライン英会話マスターコース
2. ターゲット（誰向け）：英語を話せるようになりたい社会人
3. 主な悩み/課題：英会話スクールに通う時間がない、独学では上達しない
4. 提供する解決策：1日15分のオンラインレッスンで3ヶ月で日常会話をマスター
5. 価格：月額9,800円
6. 特典/ボーナス：オリジナル単語帳PDF、発音チェックシート
7. 限定性（期間/人数）：先着30名限定で初月50%オフ
8. お客様の声：田中さん「3ヶ月で海外旅行で困らなくなりました」`
