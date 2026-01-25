import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { LPBlock, BlockType } from '@/lib/types/landing-page'

// Gemini API設定
const MODEL_TEXT = 'gemini-3-flash-preview' // Gemini 3 Flash - 最新・高速・高品質
const MODEL_TEXT_PRO = 'gemini-3-pro' // Gemini 3 Pro - 最高品質
const MODEL_IMAGE = 'nano-banana' // Nano Banana - 画像生成

// ============================================
// Phase 1: Deep Research AI（入力を深掘り・補完）
// ============================================

interface DeepResearchInput {
  product_type: string // セミナー, 商品, サービス等
  product_name: string
  target_audience: string
  main_problem: string
  solution: string
  price?: string
  bonuses?: string[]
  urgency?: string
  testimonials?: Array<{ name: string; quote: string }>
}

interface DeepResearchOutput {
  target_persona: {
    level: string
    current_state: string
    pain_points: string[]
    failed_attempts: string[]
    emotional_triggers: string[]
  }
  core_value: {
    main_promise: string
    sub_promises: string[]
  }
  objections: Array<{ type: string; detail: string }>
  proof_candidates: string[]
  recommended_tone: 'polite' | 'calm' | 'logical' | 'casual'
  cta_strategy: {
    primary_action: string
    psychological_hook: string
  }
}

const DEEP_RESEARCH_PROMPT = `あなたはマーケティング戦略の専門家です。
以下の入力をもとに、LP制作に必要な情報を「分析・補完」してください。

重要ルール：
- LP文章は絶対に書かない
- キャッチコピーも書かない
- 思考・分析・整理のみ行う
- ユーザー入力が薄くても、マーケティング知識で補完して必ず全項目を埋める
- 日本語で出力`

const DEEP_RESEARCH_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    target_persona: {
      type: SchemaType.OBJECT,
      properties: {
        level: { type: SchemaType.STRING, description: 'ターゲットのレベル（beginner/intermediate/advanced）' },
        current_state: { type: SchemaType.STRING, description: '現在の状況・課題' },
        pain_points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '具体的な悩み・痛み' },
        failed_attempts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '過去に試して失敗したこと' },
        emotional_triggers: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '感情的トリガー（不安、焦り等）' },
      },
      required: ['level', 'current_state', 'pain_points', 'failed_attempts', 'emotional_triggers'],
    },
    core_value: {
      type: SchemaType.OBJECT,
      properties: {
        main_promise: { type: SchemaType.STRING, description: 'メインの約束・価値' },
        sub_promises: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'サブの約束・価値' },
      },
      required: ['main_promise', 'sub_promises'],
    },
    objections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          detail: { type: SchemaType.STRING },
        },
      },
      description: '想定される反論・懸念',
    },
    proof_candidates: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '信頼性を高める証拠の候補' },
    recommended_tone: { type: SchemaType.STRING, enum: ['polite', 'calm', 'logical', 'casual'], description: '推奨トーン' },
    cta_strategy: {
      type: SchemaType.OBJECT,
      properties: {
        primary_action: { type: SchemaType.STRING, description: '主要なアクション' },
        psychological_hook: { type: SchemaType.STRING, description: '心理的フック' },
      },
      required: ['primary_action', 'psychological_hook'],
    },
  },
  required: ['target_persona', 'core_value', 'objections', 'proof_candidates', 'recommended_tone', 'cta_strategy'],
}

// ============================================
// Phase 2: LP Blueprint AI（構成設計）
// ============================================

interface LPBlueprint {
  hero: { focus: string; angle: string }
  problem: { points: string[] }
  benefits: string[]
  proof_strategy: string
  pricing_strategy: string
  faq_topics: string[]
  cta_direction: string
}

const LP_BLUEPRINT_PROMPT = `あなたはLP設計の専門家です。
以下の分析結果をもとに、LPの構成設計（Blueprint）を作成してください。

重要ルール：
- LP文章は書かない
- 各ブロックの「役割と論点」だけを定義
- ユーザーが行動を起こしたくなる設計にする
- 日本語で出力`

const LP_BLUEPRINT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    hero: {
      type: SchemaType.OBJECT,
      properties: {
        focus: { type: SchemaType.STRING, description: 'ヒーローの焦点（ベネフィット訴求等）' },
        angle: { type: SchemaType.STRING, description: '切り口（短時間・無料・具体等）' },
      },
      required: ['focus', 'angle'],
    },
    problem: {
      type: SchemaType.OBJECT,
      properties: {
        points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '問題点のリスト' },
      },
      required: ['points'],
    },
    benefits: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'ベネフィットのリスト' },
    proof_strategy: { type: SchemaType.STRING, description: '信頼性構築の戦略' },
    pricing_strategy: { type: SchemaType.STRING, description: '価格訴求の戦略' },
    faq_topics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'FAQで扱うトピック' },
    cta_direction: { type: SchemaType.STRING, description: 'CTAの方向性' },
  },
  required: ['hero', 'problem', 'benefits', 'proof_strategy', 'pricing_strategy', 'faq_topics', 'cta_direction'],
}

// ============================================
// Phase 3: LP Builder AI（LP JSON生成）
// ============================================

const LP_BUILDER_PROMPT = `あなたは日本のLP専門コピーライターです。
以下の設計図に忠実に、高コンバージョンなLPを生成してください。

重要ルール：
- 設計図にない主張を追加しない
- 誇大表現・薬機法違反表現は禁止
- CTAリンクは "#form" を使用
- 見出しは短く力強く
- 本文は簡潔で読みやすく
- 日本語で出力
- 各ブロックのidはUUID形式で生成`

const LP_BLOCKS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING, enum: ['hero', 'problem', 'solution', 'features', 'testimonials', 'pricing', 'bonus', 'faq', 'cta', 'form'] },
          content: { type: SchemaType.OBJECT },
          settings: {
            type: SchemaType.OBJECT,
            properties: {
              padding: { type: SchemaType.STRING, enum: ['small', 'medium', 'large'] },
              width: { type: SchemaType.STRING, enum: ['narrow', 'medium', 'full'] },
            },
          },
        },
        required: ['id', 'type', 'content', 'settings'],
      },
    },
  },
  required: ['blocks'],
}

// ============================================
// メイン生成関数（3フェーズパイプライン）
// ============================================

export interface LPGenerationInput {
  product_name: string
  target_audience: string
  main_problem: string
  solution: string
  price?: string
  bonuses?: string[]
  urgency?: string
  testimonials?: Array<{ name: string; quote: string }>
}

export interface LPGenerationResult {
  blocks: LPBlock[]
  research: DeepResearchOutput
  blueprint: LPBlueprint
}

export async function generateLPContent(input: LPGenerationInput): Promise<LPBlock[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return generateDefaultTemplate(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    // Phase 1: Deep Research
    const researchResult = await runDeepResearch(genAI, input)

    // Phase 2: LP Blueprint
    const blueprintResult = await runLPBlueprint(genAI, researchResult, input)

    // Phase 3: LP Builder
    const blocks = await runLPBuilder(genAI, blueprintResult, researchResult, input)

    return blocks
  } catch (error) {
    console.error('LP generation error:', error)
    return generateDefaultTemplate(input)
  }
}

async function runDeepResearch(genAI: GoogleGenerativeAI, input: LPGenerationInput): Promise<DeepResearchOutput> {
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: DEEP_RESEARCH_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: DEEP_RESEARCH_SCHEMA,
      temperature: 0.7,
    },
  })

  const prompt = `# 入力情報
商品名: ${input.product_name}
ターゲット: ${input.target_audience}
主な悩み: ${input.main_problem}
解決策: ${input.solution}
${input.price ? `価格: ${input.price}` : ''}
${input.bonuses?.length ? `特典: ${input.bonuses.join(', ')}` : ''}
${input.urgency ? `限定性: ${input.urgency}` : ''}

この情報をマーケティング視点で深掘りし、LP制作に必要な分析を行ってください。`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text) as DeepResearchOutput
}

async function runLPBlueprint(
  genAI: GoogleGenerativeAI,
  research: DeepResearchOutput,
  input: LPGenerationInput
): Promise<LPBlueprint> {
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: LP_BLUEPRINT_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LP_BLUEPRINT_SCHEMA,
      temperature: 0.5,
    },
  })

  const prompt = `# 深掘り分析結果
${JSON.stringify(research, null, 2)}

# 商品情報
商品名: ${input.product_name}
価格: ${input.price || '未定'}

この分析をもとに、LPの構成設計を作成してください。`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text) as LPBlueprint
}

async function runLPBuilder(
  genAI: GoogleGenerativeAI,
  blueprint: LPBlueprint,
  research: DeepResearchOutput,
  input: LPGenerationInput
): Promise<LPBlock[]> {
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: LP_BUILDER_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LP_BLOCKS_SCHEMA,
      temperature: 0.6,
    },
  })

  const prompt = `# LP設計図
${JSON.stringify(blueprint, null, 2)}

# ターゲットペルソナ
${JSON.stringify(research.target_persona, null, 2)}

# 推奨トーン
${research.recommended_tone}

# CTA戦略
${JSON.stringify(research.cta_strategy, null, 2)}

# 商品情報
商品名: ${input.product_name}
価格: ${input.price || '無料'}
${input.testimonials?.length ? `お客様の声: ${JSON.stringify(input.testimonials)}` : ''}

以下のブロック構成でLPを生成してください：
1. hero（ヒーロー）
2. problem（問題提起）
3. solution（解決策）
4. features（特徴・ベネフィット）
${input.testimonials?.length ? '5. testimonials（お客様の声）' : ''}
${input.price ? '6. pricing（価格）' : ''}
${input.bonuses?.length ? '7. bonus（特典）' : ''}
8. faq（よくある質問）
9. cta（行動喚起）
10. form（申し込みフォーム）`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)

  // UUID確認と設定デフォルト適用
  return parsed.blocks.map((block: Record<string, unknown>) => ({
    id: typeof block.id === 'string' && block.id.length > 0 ? block.id : crypto.randomUUID(),
    type: block.type as BlockType,
    content: block.content || {},
    settings: block.settings || { padding: 'medium', width: 'medium' },
  }))
}

// ============================================
// 対話修正（JSON Patch）
// ============================================

export async function refineLPContent(
  currentBlocks: LPBlock[],
  instruction: string
): Promise<LPBlock[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return currentBlocks
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: `あなたはLPの編集アシスタントです。
ユーザーの指示に従って、既存のLPブロックを更新してください。

重要ルール：
- 指示された部分のみを変更
- 他の部分は変更しない
- ブロックのid、type、settingsは可能な限り維持
- 新しいブロックを追加する場合は適切な位置に挿入
- 日本語で出力`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LP_BLOCKS_SCHEMA,
      temperature: 0.4,
    },
  })

  const prompt = `# 現在のLPブロック
${JSON.stringify(currentBlocks, null, 2)}

# ユーザーの指示
${instruction}

上記の指示に従って、LPブロックを更新してください。`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = JSON.parse(text)
    return parsed.blocks as LPBlock[]
  } catch {
    return currentBlocks
  }
}

// ============================================
// デフォルトテンプレート（APIキーなし時）
// ============================================

function generateDefaultTemplate(input: LPGenerationInput): LPBlock[] {
  return [
    {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      type: 'problem',
      content: {
        title: 'こんなお悩みありませんか？',
        problems: [input.main_problem, '解決方法が分からない', '時間がかかりすぎる'],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
    {
      id: crypto.randomUUID(),
      type: 'solution',
      content: {
        title: 'その悩み、解決できます',
        description: input.solution,
        bullets: ['簡単に始められる', '確実に結果が出る', 'サポート体制も万全'],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
    {
      id: crypto.randomUUID(),
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
    {
      id: crypto.randomUUID(),
      type: 'faq',
      content: {
        title: 'よくある質問',
        items: [
          { question: '初心者でも大丈夫ですか？', answer: 'はい、初めての方でも分かりやすく設計されています。' },
          { question: '返金はできますか？', answer: 'はい、30日間の返金保証がございます。' },
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
    {
      id: crypto.randomUUID(),
      type: 'cta',
      content: {
        title: '今すぐ始めましょう',
        description: input.urgency || 'この機会をお見逃しなく',
        button_text: '今すぐ申し込む',
        button_url: '#form',
      },
      settings: { padding: 'large', width: 'medium' },
    },
    {
      id: crypto.randomUUID(),
      type: 'form',
      content: {
        title: 'お申し込みフォーム',
        fields: [
          { name: 'name', label: 'お名前', type: 'text', required: true },
          { name: 'email', label: 'メールアドレス', type: 'email', required: true },
        ],
        submit_text: '今すぐ申し込む',
      },
      settings: { padding: 'large', width: 'narrow' },
    },
  ]
}

// ============================================
// 画像生成（Phase 4 - 将来実装）
// ============================================

export async function generateHeroImage(
  headline: string,
  personaSummary: string,
  tone: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  // TODO: Gemini Image / Nano Banana が安定したら実装
  // 現在はプレースホルダー

  return null
}

// コピペ用テンプレート
export const LP_GENERATION_PROMPT_TEMPLATE = `以下の情報を入力してください：

1. 商品/サービス名：
2. ターゲット（誰向け）：
3. 主な悩み/課題：
4. 提供する解決策：
5. 価格：
6. 特典/ボーナス：
7. 限定性（期間/人数）：
8. お客様の声（任意）：`
