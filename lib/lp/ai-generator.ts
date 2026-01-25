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

// 禁止表現リスト（薬機法・景品表示法対応）
const PROHIBITED_EXPRESSIONS = [
  '100%保証',
  '絶対に',
  '必ず稼げる',
  '誰でも簡単に',
  '確実に',
  '今だけ',
  '残りわずか',
  '奇跡の',
  '魔法の',
  '驚異の',
  '業界最安',
  '日本一',
  '世界一',
]

const DEEP_RESEARCH_PROMPT = `あなたはLP制作のプロであり、マーケティング戦略の専門家です。
以下の入力をもとに、「高コンバージョンなLP」を作るための深掘り分析を行ってください。

## あなたの役割
- LP文章は絶対に書かない（思考・分析のみ）
- キャッチコピーも書かない
- ユーザー入力が薄くても、マーケティング知識で補完して必ず全項目を埋める

## 深掘りすべき観点
1. **ペルソナ深掘り**
   - この人は今どんな状況？何に困ってる？
   - 過去に何を試して、なぜうまくいかなかった？
   - どんな感情を抱えてる？（不安、焦り、悔しさ、期待）

2. **反論・懸念の洗い出し**
   - 「怪しい」「時間ない」「初心者無理」「高い」など
   - これらをどう潰すか？

3. **約束の明確化**
   - 主張は1つに絞る
   - サブの約束は3つまで

4. **証拠の補完**
   - 実績が弱い場合の代替案
   - 権威付けの方向性

日本語で出力してください。`

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
深掘り分析の結果をもとに、「高コンバージョンなLP」の構成設計（Blueprint）を作成してください。

## あなたの役割
- LP文章は書かない（設計図のみ）
- 各ブロックで「何を言うか」「なぜ言うか」を明確にする
- ユーザーが自然と行動したくなる流れを設計する

## 設計すべきブロックと論点

1. **Hero（ファーストビュー）**
   - 一言で「何が得られるか」を伝える
   - 切り口：短時間？無料？具体的な数字？

2. **Problem（共感・問題提起）**
   - ペルソナの悩みを3つ挙げる
   - 「そうそう、それ！」と思わせる

3. **Benefits（得られる結果）**
   - 機能ではなく「変化」を3つ
   - Before → After を意識

4. **Proof（信頼性・証拠）**
   - 実績、数字、事例、権威
   - 弱い場合は「なぜ信頼できるか」の代替案

5. **FAQ（反論潰し）**
   - 想定される懸念を3つ潰す
   - 「初心者でも大丈夫？」「売り込みある？」等

6. **CTA（行動喚起）**
   - 煽りすぎない
   - 行動のハードルを下げる一言

日本語で出力してください。`

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

const LP_BUILDER_PROMPT = `あなたは日本のLP専門コピーライターです。CVR5%以上を達成してきた実績があります。
深掘り分析と設計図に忠実に、「読者が自然と申し込みたくなる」LPを生成してください。

## あなたのスタイル
- 煽りすぎない（信頼を損なう）
- 丁寧だが力強い
- 具体的な数字や事例を使う
- 読者の感情に寄り添う

## 絶対ルール
1. **設計図にない主張は追加しない**
2. **禁止表現は使わない**
   - 100%保証、絶対に、必ず稼げる、誰でも簡単に
   - 今だけ、残りわずか、奇跡の、魔法の
   - 業界最安、日本一、世界一
3. **CTAリンクは "#form" のみ**
4. **CTAは1つだけ（迷わせない）**
5. **見出しは短く力強く（15文字以内推奨）**
6. **本文は簡潔で読みやすく（1文30文字以内推奨）**
7. **各ブロックのidはUUID形式で生成**

## 文章の書き方
- 「あなた」ではなく読者の状況を描写
- 機能より「変化」を伝える
- 反論は認めてから潰す
- 最後の一押しは「失うもの」より「得るもの」

日本語で出力してください。`

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
    systemInstruction: `あなたはLPの編集アシスタントです。CVR5%以上を達成してきた実績があります。
ユーザーの自然文による指示を理解し、LPブロックを適切に更新してください。

## 対応できる指示の例
- 「Heroをもっと短く」→ headline/subheadlineを簡潔に
- 「価格を9,800円に変更」→ pricingブロックを更新
- 「FAQを2つ追加」→ faqブロックにitemsを追加
- 「もっと初心者向けに」→ 全体のトーンを調整
- 「煽りを減らして」→ 誇大表現を削除

## 絶対ルール
- 指示された部分のみを変更（他は維持）
- ブロックのid、type、settingsは可能な限り維持
- 禁止表現は使わない
- 構造を壊さない（JSONの整合性を保つ）
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

// ============================================
// 画像からLP構成を解析（スクリーンショット対応）
// ============================================

const IMAGE_ANALYSIS_PROMPT = `あなたはLP/Webデザインの専門家です。
アップロードされた画像（LPやWebサイトのスクリーンショット）を分析し、
そのデザイン構成・レイアウト・雰囲気を詳細に抽出してください。

## 分析すべき項目

1. **全体の雰囲気・トーン**
   - カラースキーム（メインカラー、アクセントカラー）
   - デザインスタイル（モダン、ミニマル、コーポレート、カジュアル等）
   - フォントの印象（太め、細め、丸み等）

2. **セクション構成**
   - ファーストビュー（Hero）の構成
   - 各セクションの順番と内容
   - CTAの配置と数

3. **レイアウトの特徴**
   - カラム構成（1カラム、2カラム等）
   - 余白の使い方
   - 画像と文字のバランス

4. **特徴的な要素**
   - アイコンの使い方
   - カード型デザインの有無
   - アニメーション・動きの示唆

日本語で出力してください。`

const IMAGE_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    design_style: {
      type: SchemaType.OBJECT,
      properties: {
        overall_tone: { type: SchemaType.STRING, description: '全体の雰囲気（モダン、ミニマル、コーポレート、カジュアル等）' },
        main_color: { type: SchemaType.STRING, description: 'メインカラー（例：#3B82F6、青系）' },
        accent_color: { type: SchemaType.STRING, description: 'アクセントカラー' },
        font_style: { type: SchemaType.STRING, description: 'フォントの印象' },
      },
      required: ['overall_tone', 'main_color'],
    },
    sections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING, description: 'セクションタイプ（hero, features, testimonials等）' },
          layout: { type: SchemaType.STRING, description: 'レイアウト（1カラム、2カラム、グリッド等）' },
          description: { type: SchemaType.STRING, description: '内容の説明' },
        },
        required: ['type', 'description'],
      },
      description: 'セクション構成の配列',
    },
    cta_style: {
      type: SchemaType.OBJECT,
      properties: {
        button_style: { type: SchemaType.STRING, description: 'ボタンスタイル（丸み、色、サイズ）' },
        placement: { type: SchemaType.STRING, description: 'CTAの配置パターン' },
      },
    },
    special_features: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '特徴的なデザイン要素',
    },
  },
  required: ['design_style', 'sections'],
}

export interface ImageAnalysisResult {
  design_style: {
    overall_tone: string
    main_color: string
    accent_color?: string
    font_style?: string
  }
  sections: Array<{
    type: string
    layout?: string
    description: string
  }>
  cta_style?: {
    button_style?: string
    placement?: string
  }
  special_features?: string[]
}

export async function analyzeImageForLP(imageBase64: string, mimeType: string): Promise<ImageAnalysisResult | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: IMAGE_ANALYSIS_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: IMAGE_ANALYSIS_SCHEMA,
      temperature: 0.5,
    },
  })

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      },
      'この画像のLP/Webサイトのデザイン構成を分析してください。',
    ])

    const text = result.response.text()
    return JSON.parse(text) as ImageAnalysisResult
  } catch (error) {
    console.error('Image analysis error:', error)
    return null
  }
}

// 画像分析結果を元にLP生成（画像からの生成）
export async function generateLPFromImage(
  imageAnalysis: ImageAnalysisResult,
  input: LPGenerationInput
): Promise<LPBlock[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return generateDefaultTemplate(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    // Phase 1: Deep Research（画像分析結果も考慮）
    const researchResult = await runDeepResearch(genAI, input)

    // Phase 2: LP Blueprint（画像分析結果を反映）
    const blueprintResult = await runLPBlueprintWithDesign(genAI, researchResult, input, imageAnalysis)

    // Phase 3: LP Builder（デザインスタイルを反映）
    const blocks = await runLPBuilderWithDesign(genAI, blueprintResult, researchResult, input, imageAnalysis)

    return blocks
  } catch (error) {
    console.error('LP generation from image error:', error)
    return generateDefaultTemplate(input)
  }
}

async function runLPBlueprintWithDesign(
  genAI: GoogleGenerativeAI,
  research: DeepResearchOutput,
  input: LPGenerationInput,
  imageAnalysis: ImageAnalysisResult
): Promise<LPBlueprint> {
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: LP_BLUEPRINT_PROMPT + `

## 参考デザインの特徴
- 全体トーン: ${imageAnalysis.design_style.overall_tone}
- メインカラー: ${imageAnalysis.design_style.main_color}
- セクション構成: ${imageAnalysis.sections.map(s => s.type).join(' → ')}
${imageAnalysis.special_features ? `- 特徴的要素: ${imageAnalysis.special_features.join(', ')}` : ''}

この参考デザインの雰囲気を取り入れた構成にしてください。`,
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

# 参考デザインのセクション構成
${imageAnalysis.sections.map((s, i) => `${i + 1}. ${s.type}: ${s.description}`).join('\n')}

参考デザインの構成と雰囲気を活かしたLP設計図を作成してください。`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text) as LPBlueprint
}

async function runLPBuilderWithDesign(
  genAI: GoogleGenerativeAI,
  blueprint: LPBlueprint,
  research: DeepResearchOutput,
  input: LPGenerationInput,
  imageAnalysis: ImageAnalysisResult
): Promise<LPBlock[]> {
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: LP_BUILDER_PROMPT + `

## 参考デザインのスタイルガイド
- 全体トーン: ${imageAnalysis.design_style.overall_tone}
- メインカラー: ${imageAnalysis.design_style.main_color}
- アクセントカラー: ${imageAnalysis.design_style.accent_color || '自動'}
- フォントスタイル: ${imageAnalysis.design_style.font_style || '標準'}
${imageAnalysis.cta_style ? `- CTAスタイル: ${imageAnalysis.cta_style.button_style || '標準'}` : ''}

このスタイルに合わせたLPを生成してください。`,
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

# 参考デザインの特徴
${imageAnalysis.special_features ? imageAnalysis.special_features.join('\n') : 'なし'}

# 商品情報
商品名: ${input.product_name}
価格: ${input.price || '無料'}
${input.testimonials?.length ? `お客様の声: ${JSON.stringify(input.testimonials)}` : ''}

参考デザインの雰囲気を反映したLPを生成してください。`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)

  return parsed.blocks.map((block: Record<string, unknown>) => ({
    id: typeof block.id === 'string' && block.id.length > 0 ? block.id : crypto.randomUUID(),
    type: block.type as BlockType,
    content: block.content || {},
    settings: {
      ...(block.settings as Record<string, unknown> || { padding: 'medium', width: 'medium' }),
      // 参考デザインのカラーを適用
      background_color: imageAnalysis.design_style.main_color,
    },
  }))
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
