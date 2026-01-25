import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini 3 API設定
const MODEL_TEXT = 'gemini-3-flash-preview' // Gemini 3 Flash
const MODEL_PRO = 'gemini-2.5-pro-preview-05-06' // 深い思考用

export interface LPGenerationInput {
  product_name: string
  target_audience: string
  main_problem: string
  solution: string
  price?: string
  bonuses?: string[]
  urgency?: string
  testimonials?: Array<{ name: string; quote: string }>
  brand_keywords?: string[]
  key_features?: string[]
  desired_action?: string
}

// ========================================
// Step 1: 深層分析の出力型
// ========================================
export interface DeepAnalysisResult {
  target_psychology: {
    surface_needs: string[]
    deep_desires: string[]
    fears_and_anxieties: string[]
    decision_barriers: string[]
  }
  emotional_journey: {
    current_state: string
    desired_state: string
    transformation_story: string
  }
  market_positioning: {
    unique_angle: string
    competitor_gaps: string[]
    value_proposition: string
  }
  persuasion_strategy: {
    primary_appeal: 'emotional' | 'logical' | 'social_proof'
    key_triggers: string[]
    objection_handlers: string[]
  }
}

// ========================================
// Step 2: デザインコンセプトの出力型
// ========================================
export interface DesignConceptResult {
  color_palette: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    cta: string
    rationale: string
  }
  typography: {
    heading_font: string
    body_font: string
    heading_weight: string
    body_weight: string
    rationale: string
  }
  visual_mood: {
    overall_tone: string
    imagery_style: string
    spacing_philosophy: string
    animation_approach: string
  }
  layout_principles: {
    structure: string
    visual_hierarchy: string[]
    mobile_first_considerations: string[]
  }
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

// セクション単位の出力
export interface LPSection {
  id: string
  type: 'hero' | 'problem' | 'empathy' | 'solution' | 'features' | 'testimonials' | 'faq' | 'cta'
  html: string
  order: number
}

export interface LPGenerationResult {
  sections: LPSection[]
  globalCss: string
  title: string
  meta_description: string
}

// セクション別HTML生成用プロンプト
const SECTION_GENERATION_PROMPT = `あなたは世界トップクラスのLP制作者です。
指定されたセクションのHTMLを生成してください。

## 絶対ルール

### コピーライティング
- 見出しは15文字以内で強烈なインパクト
- 一文は30文字以内で簡潔に
- 「あなた」視点で語りかける
- 数字を具体的に入れる
- 感情を揺さぶる言葉を使う

### 禁止表現（薬機法・景品表示法）
以下は絶対に使わない：
- 「100%保証」「絶対に」「必ず」「確実に」
- 「誰でも簡単に」「今だけ」「残りわずか」
- 「奇跡の」「魔法の」「驚異の」
- 「業界最安」「日本一」「世界一」

### デザイン要件
- モダンで洗練されたデザイン
- 適切な余白（padding: 60px〜100px）
- 視線誘導を意識
- CTAボタンは目立つ色で大きく
- スマホ対応（レスポンシブ）

## 出力形式
<section>タグで囲んだHTMLのみを出力。
CSSはstyle属性またはインラインで含める。
余計な説明は不要。
`

// セクションタイプごとの追加指示
const SECTION_INSTRUCTIONS: Record<string, string> = {
  hero: `
【ヒーローセクション】
- 画面いっぱいのインパクト（min-height: 80vh）
- グラデーション背景
- 大きなキャッチコピー（font-size: 2.5rem以上）
- サブコピー
- 目立つCTAボタン
`,
  problem: `
【問題提起セクション】
- 「こんな悩みありませんか？」形式
- 3〜5個の具体的な悩み
- アイコンやチェックマーク使用
- 共感を誘う表現
`,
  empathy: `
【共感セクション】
- 「その気持ち、よくわかります」
- ターゲットの感情に寄り添う
- 過去の失敗体験への理解
`,
  solution: `
【解決策セクション】
- 「だから〇〇を作りました」
- 商品/サービスの紹介
- 左右レイアウト（テキスト + イメージ）
`,
  features: `
【特徴/ベネフィットセクション】
- 3つのポイントをカード形式
- アイコン + タイトル + 説明
- グリッドレイアウト
`,
  testimonials: `
【お客様の声セクション】
- 引用形式のデザイン
- 名前と属性
- 信頼感のあるレイアウト
`,
  faq: `
【よくある質問セクション】
- Q&A形式
- 3〜5個の質問
- 不安を払拭する回答
`,
  cta: `
【最終CTAセクション】
- 強烈な背景色
- 大きな見出し
- 目立つボタン（大きく、影付き）
- 行動を促す文言
`,
}

// 全セクション一括生成用プロンプト
const FULL_LP_PROMPT = `あなたは世界トップクラスのLP制作者です。
CVR5%以上を実現する、圧倒的に強いLPを生成してください。

## 絶対ルール

### コピーライティング
- 見出しは15文字以内で強烈なインパクト
- 一文は30文字以内で簡潔に
- 「あなた」視点で語りかける
- 数字を具体的に入れる
- 感情を揺さぶる言葉を使う

### 禁止表現
- 「100%保証」「絶対に」「必ず」「確実に」使用禁止
- 「誰でも簡単に」「今だけ」「残りわずか」使用禁止

### デザイン
- モダンで洗練されたデザイン
- 適切な余白（セクション間は60px以上）
- CTAボタンは目立つ色で大きく
- レスポンシブ対応

## 出力形式（重要）

以下のJSON形式で出力してください。各セクションのhtmlは完全なHTMLを含めてください。

\`\`\`json
{
  "globalCss": "/* 全体に適用するCSS */",
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "html": "<section class='hero'>...</section>",
      "order": 0
    },
    {
      "id": "problem",
      "type": "problem", 
      "html": "<section class='problem'>...</section>",
      "order": 1
    },
    ...
  ],
  "title": "ページタイトル",
  "meta_description": "メタディスクリプション"
}
\`\`\`

セクションタイプ: hero, problem, empathy, solution, features, testimonials, faq, cta
`

// ========================================
// Step 1: 深層分析プロンプト（ペルソナ・チェーン技法）
// ========================================
const DEEP_ANALYSIS_PROMPT = `あなたは3人の専門家として順番に思考してください。

【専門家1: 消費者心理学者】
まず、ターゲット顧客の心理を深く分析してください：
- 表面的なニーズ vs 深層の欲求
- 隠れた恐れや不安
- 購入を躊躇させる心理的障壁

【専門家2: ブランドストラテジスト】
次に、市場でのポジショニングを検討してください：
- 競合との差別化ポイント
- 独自の価値提案
- ブランドストーリーの核

【専門家3: 行動経済学者】
最後に、購買行動を促す戦略を設計してください：
- 感情訴求 vs 論理訴求のバランス
- 心理的トリガー
- 反論への対処法

## 入力情報
商品名: {product_name}
ターゲット: {target_audience}
主な問題: {main_problem}
解決策: {solution}
特徴: {key_features}
ブランドキーワード: {brand_keywords}

## 出力形式（JSON）
\`\`\`json
{
  "target_psychology": {
    "surface_needs": ["表面的ニーズ1", "..."],
    "deep_desires": ["深層の欲求1", "..."],
    "fears_and_anxieties": ["恐れ1", "..."],
    "decision_barriers": ["障壁1", "..."]
  },
  "emotional_journey": {
    "current_state": "現在の状態の描写",
    "desired_state": "理想の状態の描写",
    "transformation_story": "変化のストーリー"
  },
  "market_positioning": {
    "unique_angle": "独自の切り口",
    "competitor_gaps": ["競合の隙間1", "..."],
    "value_proposition": "価値提案"
  },
  "persuasion_strategy": {
    "primary_appeal": "emotional または logical または social_proof",
    "key_triggers": ["トリガー1", "..."],
    "objection_handlers": ["反論対処1", "..."]
  }
}
\`\`\`
`

// ========================================
// Step 2: デザインコンセプトプロンプト
// ========================================
const DESIGN_CONCEPT_PROMPT = `あなたはAppleとAirbnb出身のシニアデザイナーです。
深層分析の結果を元に、LPの視覚的方向性を定義してください。

【色彩心理学に基づくカラーパレット設計】
- 主要感情: 信頼/興奮/安心/高級感など
- 業界慣習との差別化
- アクセシビリティ考慮

【タイポグラフィ選定】
- ブランドパーソナリティの反映
- 可読性と印象のバランス
- 日本語対応フォント推奨

【ビジュアルムード】
- 全体のトーン（ミニマル/リッチ/テクニカル等）
- 写真/イラスト/グラフィックのスタイル
- 余白の哲学

## 深層分析結果
{deep_analysis}

## 入力情報
商品名: {product_name}
ターゲット: {target_audience}
ブランドキーワード: {brand_keywords}

## 出力形式（JSON）
\`\`\`json
{
  "color_palette": {
    "primary": "#XXXXXX",
    "secondary": "#XXXXXX",
    "accent": "#XXXXXX",
    "background": "#XXXXXX",
    "text": "#XXXXXX",
    "cta": "#XXXXXX",
    "rationale": "カラー選定の根拠"
  },
  "typography": {
    "heading_font": "フォント名",
    "body_font": "フォント名",
    "heading_weight": "700",
    "body_weight": "400",
    "rationale": "フォント選定の根拠"
  },
  "visual_mood": {
    "overall_tone": "全体トーン",
    "imagery_style": "画像スタイル",
    "spacing_philosophy": "余白の考え方",
    "animation_approach": "アニメーション方針"
  },
  "layout_principles": {
    "structure": "レイアウト構造",
    "visual_hierarchy": ["階層1", "階層2", "..."],
    "mobile_first_considerations": ["考慮点1", "..."]
  }
}
\`\`\`
`

// ========================================
// Step 4: 自己批評プロンプト
// ========================================
const SELF_CRITIQUE_PROMPT = `あなたは厳格なデザインクリティックです。
生成されたLPを以下の観点から厳しく評価し、改善版を出力してください。

【評価観点】
1. デザインの一貫性（色/フォント/余白の統一）
2. 視覚的階層（情報の優先度が明確か）
3. コンバージョン導線（CTAへの誘導が自然か）
4. 感情的インパクト（心に響くか）
5. 法的リスク（禁止表現がないか）
6. モバイル体験（スマホで見やすいか）

【批評の厳格さ】
- 「まあまあ」は不可。「卓越」か「改善必要」のみ
- 各項目で具体的な問題点と改善案を提示
- 改善後のコードを必ず出力

## 現在のLP
{current_lp}

## デザインコンセプト（これに沿っているか確認）
{design_concept}

## 深層分析（心理的効果を確認）
{deep_analysis}

## 出力形式
まず批評を述べ、その後改善版のJSONを出力してください。

\`\`\`json
{
  "critique": {
    "consistency": { "score": 1-5, "issues": [], "improvements": [] },
    "hierarchy": { "score": 1-5, "issues": [], "improvements": [] },
    "conversion": { "score": 1-5, "issues": [], "improvements": [] },
    "emotional_impact": { "score": 1-5, "issues": [], "improvements": [] },
    "legal_compliance": { "score": 1-5, "issues": [], "improvements": [] },
    "mobile_experience": { "score": 1-5, "issues": [], "improvements": [] }
  },
  "improved_lp": {
    "globalCss": "改善後のCSS",
    "sections": [...],
    "title": "...",
    "meta_description": "..."
  }
}
\`\`\`
`

// 画像分析プロンプト
const IMAGE_ANALYSIS_PROMPT = `あなたはLP/Webデザインの専門家です。
この画像のデザイン構成を分析し、以下の情報をJSON形式で出力してください。

1. 全体の雰囲気・トーン
2. カラースキーム（メインカラー、アクセントカラー）
3. セクション構成
4. 特徴的なデザイン要素

JSON形式で出力：
{
  "design_style": {
    "overall_tone": "モダン/ミニマル/コーポレート等",
    "main_color": "#XXXXXX",
    "accent_color": "#XXXXXX"
  },
  "sections": [
    { "type": "hero", "description": "説明" },
    ...
  ],
  "special_features": ["特徴1", "特徴2"]
}
`

export async function analyzeReferenceImage(
  imageBase64: string,
  mimeType: string
): Promise<ImageAnalysisResult | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL_TEXT })

  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      IMAGE_ANALYSIS_PROMPT,
    ])

    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ImageAnalysisResult
    }
    return null
  } catch (error) {
    console.error('Image analysis error:', error)
    return null
  }
}

// ========================================
// Step 1: 深層分析
// ========================================
export async function runDeepAnalysis(
  input: LPGenerationInput
): Promise<DeepAnalysisResult | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_PRO,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 8192,
    },
  })

  const prompt = DEEP_ANALYSIS_PROMPT
    .replace('{product_name}', input.product_name)
    .replace('{target_audience}', input.target_audience)
    .replace('{main_problem}', input.main_problem)
    .replace('{solution}', input.solution)
    .replace('{key_features}', (input.key_features || []).join(', ') || 'なし')
    .replace('{brand_keywords}', (input.brand_keywords || []).join(', ') || 'なし')

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      return JSON.parse(jsonStr) as DeepAnalysisResult
    }
    return null
  } catch (error) {
    console.error('Deep analysis error:', error)
    return null
  }
}

// ========================================
// Step 2: デザインコンセプト決定
// ========================================
export async function runDesignConcept(
  input: LPGenerationInput,
  deepAnalysis: DeepAnalysisResult
): Promise<DesignConceptResult | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_PRO,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,
    },
  })

  const prompt = DESIGN_CONCEPT_PROMPT
    .replace('{deep_analysis}', JSON.stringify(deepAnalysis, null, 2))
    .replace('{product_name}', input.product_name)
    .replace('{target_audience}', input.target_audience)
    .replace('{brand_keywords}', (input.brand_keywords || []).join(', ') || 'なし')

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      return JSON.parse(jsonStr) as DesignConceptResult
    }
    return null
  } catch (error) {
    console.error('Design concept error:', error)
    return null
  }
}

// ========================================
// Step 4: 自己批評と改善
// ========================================
export async function runSelfCritique(
  currentLp: LPGenerationResult,
  designConcept: DesignConceptResult,
  deepAnalysis: DeepAnalysisResult
): Promise<LPGenerationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return currentLp

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_PRO,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
    },
  })

  const prompt = SELF_CRITIQUE_PROMPT
    .replace('{current_lp}', JSON.stringify(currentLp, null, 2))
    .replace('{design_concept}', JSON.stringify(designConcept, null, 2))
    .replace('{deep_analysis}', JSON.stringify(deepAnalysis, null, 2))

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      if (parsed.improved_lp) {
        return {
          sections: parsed.improved_lp.sections || currentLp.sections,
          globalCss: parsed.improved_lp.globalCss || currentLp.globalCss,
          title: parsed.improved_lp.title || currentLp.title,
          meta_description: parsed.improved_lp.meta_description || currentLp.meta_description,
        }
      }
    }
    return currentLp
  } catch (error) {
    console.error('Self critique error:', error)
    return currentLp
  }
}

// ========================================
// 4段階統合: 高品質LP生成（フルパイプライン）
// ========================================
export interface AdvancedLPGenerationResult extends LPGenerationResult {
  deepAnalysis?: DeepAnalysisResult
  designConcept?: DesignConceptResult
  critiquePassed?: boolean
}

export async function generateAdvancedLP(
  input: LPGenerationInput,
  imageAnalysis?: ImageAnalysisResult | null,
  options?: {
    skipDeepAnalysis?: boolean
    skipDesignConcept?: boolean
    skipSelfCritique?: boolean
    onProgress?: (step: string, data?: unknown) => void
  }
): Promise<AdvancedLPGenerationResult> {
  const { onProgress } = options || {}
  
  let deepAnalysis: DeepAnalysisResult | null = null
  let designConcept: DesignConceptResult | null = null

  // Step 1: 深層分析
  if (!options?.skipDeepAnalysis) {
    onProgress?.('deep_analysis_start')
    deepAnalysis = await runDeepAnalysis(input)
    onProgress?.('deep_analysis_complete', deepAnalysis)
  }

  // Step 2: デザインコンセプト
  if (!options?.skipDesignConcept && deepAnalysis) {
    onProgress?.('design_concept_start')
    designConcept = await runDesignConcept(input, deepAnalysis)
    onProgress?.('design_concept_complete', designConcept)
  }

  // Step 3: LP構造生成（デザインコンセプトを反映）
  onProgress?.('structure_generation_start')
  const initialLp = await generateLPWithConcept(input, designConcept, deepAnalysis, imageAnalysis)
  onProgress?.('structure_generation_complete', initialLp)

  // Step 4: 自己批評と改善
  let finalLp = initialLp
  if (!options?.skipSelfCritique && designConcept && deepAnalysis) {
    onProgress?.('self_critique_start')
    finalLp = await runSelfCritique(initialLp, designConcept, deepAnalysis)
    onProgress?.('self_critique_complete', finalLp)
  }

  return {
    ...finalLp,
    deepAnalysis: deepAnalysis || undefined,
    designConcept: designConcept || undefined,
    critiquePassed: true,
  }
}

// デザインコンセプトを反映したLP生成
async function generateLPWithConcept(
  input: LPGenerationInput,
  designConcept: DesignConceptResult | null,
  deepAnalysis: DeepAnalysisResult | null,
  imageAnalysis?: ImageAnalysisResult | null
): Promise<LPGenerationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return generateDefaultSections(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 16384,
    },
  })

  // デザインコンセプトからの指示を構築
  let designInstructions = ''
  if (designConcept) {
    designInstructions = `
## デザインコンセプト（厳守）
### カラーパレット
- プライマリ: ${designConcept.color_palette.primary}
- セカンダリ: ${designConcept.color_palette.secondary}
- アクセント: ${designConcept.color_palette.accent}
- 背景: ${designConcept.color_palette.background}
- テキスト: ${designConcept.color_palette.text}
- CTA: ${designConcept.color_palette.cta}

### タイポグラフィ
- 見出し: ${designConcept.typography.heading_font}, ${designConcept.typography.heading_weight}
- 本文: ${designConcept.typography.body_font}, ${designConcept.typography.body_weight}

### ビジュアルムード
- 全体トーン: ${designConcept.visual_mood.overall_tone}
- 画像スタイル: ${designConcept.visual_mood.imagery_style}
- 余白: ${designConcept.visual_mood.spacing_philosophy}
`
  }

  // 深層分析からの指示
  let psychologyInstructions = ''
  if (deepAnalysis) {
    psychologyInstructions = `
## 心理戦略（反映必須）
### 深層欲求に訴える
${deepAnalysis.target_psychology.deep_desires.map(d => `- ${d}`).join('\n')}

### 克服すべき恐れ
${deepAnalysis.target_psychology.fears_and_anxieties.map(f => `- ${f}`).join('\n')}

### 説得戦略
- 主要アプローチ: ${deepAnalysis.persuasion_strategy.primary_appeal}
- キートリガー: ${deepAnalysis.persuasion_strategy.key_triggers.join(', ')}

### 変化のストーリー
${deepAnalysis.emotional_journey.transformation_story}
`
  }

  // 参考画像からの指示
  let imageInstructions = ''
  if (imageAnalysis) {
    imageInstructions = `
## 参考デザインの特徴
- 全体トーン: ${imageAnalysis.design_style.overall_tone}
- メインカラー: ${imageAnalysis.design_style.main_color}
${imageAnalysis.special_features ? `- 特徴: ${imageAnalysis.special_features.join(', ')}` : ''}
`
  }

  const prompt = `${FULL_LP_PROMPT}

${designInstructions}

${psychologyInstructions}

${imageInstructions}

## LP情報

商品/サービス名: ${input.product_name}
ターゲット: ${input.target_audience}
主な悩み: ${input.main_problem}
解決策: ${input.solution}
価格: ${input.price || '無料'}
${input.bonuses?.length ? `特典: ${input.bonuses.join(', ')}` : ''}
${input.urgency ? `限定性: ${input.urgency}` : ''}
${input.testimonials?.length ? `お客様の声: ${JSON.stringify(input.testimonials)}` : ''}
${input.key_features?.length ? `特徴: ${input.key_features.join(', ')}` : ''}

JSON形式で出力してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      return {
        sections: parsed.sections || [],
        globalCss: parsed.globalCss || getDefaultCss(),
        title: parsed.title || input.product_name,
        meta_description: parsed.meta_description || `${input.target_audience}のための${input.product_name}`,
      }
    }

    return generateDefaultSections(input)
  } catch (error) {
    console.error('LP generation error:', error)
    return generateDefaultSections(input)
  }
}

// LP全体を生成（セクションベース）
export async function generateLPHTML(
  input: LPGenerationInput,
  imageAnalysis?: ImageAnalysisResult | null
): Promise<LPGenerationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return generateDefaultSections(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 16384,
    },
  })

  // デザイン指示を構築
  let designInstructions = ''
  if (imageAnalysis) {
    designInstructions = `
## 参考デザインの特徴（これを反映してください）
- 全体トーン: ${imageAnalysis.design_style.overall_tone}
- メインカラー: ${imageAnalysis.design_style.main_color}
- アクセントカラー: ${imageAnalysis.design_style.accent_color || '自動'}
${imageAnalysis.special_features ? `- 特徴: ${imageAnalysis.special_features.join(', ')}` : ''}
`
  }

  const prompt = `${FULL_LP_PROMPT}

${designInstructions}

## LP情報

商品/サービス名: ${input.product_name}
ターゲット: ${input.target_audience}
主な悩み: ${input.main_problem}
解決策: ${input.solution}
価格: ${input.price || '無料'}
${input.bonuses?.length ? `特典: ${input.bonuses.join(', ')}` : ''}
${input.urgency ? `限定性: ${input.urgency}` : ''}
${input.testimonials?.length ? `お客様の声: ${JSON.stringify(input.testimonials)}` : ''}

JSON形式で出力してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // JSONを抽出
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      return {
        sections: parsed.sections || [],
        globalCss: parsed.globalCss || getDefaultCss(),
        title: parsed.title || input.product_name,
        meta_description: parsed.meta_description || `${input.target_audience}のための${input.product_name}`,
      }
    }

    return generateDefaultSections(input)
  } catch (error) {
    console.error('LP generation error:', error)
    return generateDefaultSections(input)
  }
}

// 個別セクションを生成/再生成
export async function generateSection(
  sectionType: string,
  input: LPGenerationInput,
  customInstruction?: string
): Promise<LPSection> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return getDefaultSection(sectionType, input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 4096,
    },
  })

  const sectionInstruction = SECTION_INSTRUCTIONS[sectionType] || ''

  const prompt = `${SECTION_GENERATION_PROMPT}

${sectionInstruction}

${customInstruction ? `## 追加指示\n${customInstruction}` : ''}

## LP情報
商品/サービス名: ${input.product_name}
ターゲット: ${input.target_audience}
主な悩み: ${input.main_problem}
解決策: ${input.solution}
価格: ${input.price || '無料'}

<section>タグで囲んだHTMLのみを出力してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // HTMLを抽出
    const sectionMatch = text.match(/<section[\s\S]*?<\/section>/i)
    const html = sectionMatch ? sectionMatch[0] : getDefaultSection(sectionType, input).html

    return {
      id: crypto.randomUUID(),
      type: sectionType as LPSection['type'],
      html,
      order: 0,
    }
  } catch (error) {
    console.error('Section generation error:', error)
    return getDefaultSection(sectionType, input)
  }
}

// セクションを編集（指示に基づいて）
export async function editSection(
  section: LPSection,
  instruction: string,
  input: LPGenerationInput
): Promise<LPSection> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return section
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  })

  const prompt = `以下のセクションHTMLを指示に従って編集してください。

## 現在のHTML
${section.html}

## 編集指示
${instruction}

## LP情報
商品/サービス名: ${input.product_name}
ターゲット: ${input.target_audience}

編集後の<section>タグで囲んだHTMLのみを出力してください。
余計な説明は不要です。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    const sectionMatch = text.match(/<section[\s\S]*?<\/section>/i)
    const html = sectionMatch ? sectionMatch[0] : section.html

    return {
      ...section,
      html,
    }
  } catch (error) {
    console.error('Section edit error:', error)
    return section
  }
}

// デフォルトセクション（APIエラー時のフォールバック）
function generateDefaultSections(input: LPGenerationInput): LPGenerationResult {
  return {
    sections: [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        html: `<section class="hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 100px 20px; text-align: center; min-height: 80vh; display: flex; align-items: center; justify-content: center;">
  <div style="max-width: 800px;">
    <h1 style="font-size: clamp(28px, 5vw, 48px); font-weight: bold; margin-bottom: 20px;">${input.main_problem}を解決する</h1>
    <p style="font-size: clamp(16px, 3vw, 24px); margin-bottom: 40px; opacity: 0.9;">${input.solution}</p>
    <a href="#form" style="display: inline-block; background: #ff6b6b; color: white; padding: 18px 48px; border-radius: 50px; text-decoration: none; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);">今すぐ申し込む</a>
  </div>
</section>`,
        order: 0,
      },
      {
        id: crypto.randomUUID(),
        type: 'problem',
        html: `<section class="problem" style="padding: 80px 20px; background: #f8f9fa;">
  <div style="max-width: 800px; margin: 0 auto;">
    <h2 style="font-size: clamp(24px, 4vw, 36px); text-align: center; margin-bottom: 40px;">こんなお悩みありませんか？</h2>
    <ul style="list-style: none; max-width: 600px; margin: 0 auto;">
      <li style="padding: 20px; margin-bottom: 15px; background: white; border-left: 4px solid #ff6b6b; border-radius: 4px;">${input.main_problem}</li>
      <li style="padding: 20px; margin-bottom: 15px; background: white; border-left: 4px solid #ff6b6b; border-radius: 4px;">解決方法が分からない</li>
      <li style="padding: 20px; margin-bottom: 15px; background: white; border-left: 4px solid #ff6b6b; border-radius: 4px;">時間がかかりすぎる</li>
    </ul>
  </div>
</section>`,
        order: 1,
      },
      {
        id: crypto.randomUUID(),
        type: 'solution',
        html: `<section class="solution" style="padding: 80px 20px;">
  <div style="max-width: 1000px; margin: 0 auto;">
    <h2 style="font-size: clamp(24px, 4vw, 36px); text-align: center; margin-bottom: 40px;">その悩み、解決できます</h2>
    <p style="text-align: center; font-size: 18px; margin-bottom: 40px;">${input.solution}</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
      <div style="background: white; padding: 40px 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 20px;">簡単スタート</h3>
        <p>初心者でも始められる</p>
      </div>
      <div style="background: white; padding: 40px 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 20px;">確かな実績</h3>
        <p>多くの方が成果を出しています</p>
      </div>
      <div style="background: white; padding: 40px 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 20px;">充実サポート</h3>
        <p>困ったときも安心</p>
      </div>
    </div>
  </div>
</section>`,
        order: 2,
      },
      {
        id: crypto.randomUUID(),
        type: 'cta',
        html: `<section class="cta" id="form" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 20px; text-align: center;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="font-size: clamp(24px, 4vw, 36px); margin-bottom: 20px; color: white;">今すぐ始めましょう</h2>
    <p style="font-size: 32px; font-weight: bold; margin-bottom: 30px;">${input.price || '無料'}</p>
    <a href="#" style="display: inline-block; background: #ff6b6b; color: white; padding: 24px 64px; border-radius: 50px; text-decoration: none; font-size: 22px; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);">申し込む</a>
  </div>
</section>`,
        order: 3,
      },
    ],
    globalCss: getDefaultCss(),
    title: input.product_name,
    meta_description: `${input.target_audience}のための${input.product_name}`,
  }
}

// 個別セクションのデフォルト
function getDefaultSection(sectionType: string, input: LPGenerationInput): LPSection {
  const defaults = generateDefaultSections(input)
  const section = defaults.sections.find((s) => s.type === sectionType)
  return section || defaults.sections[0]
}

// デフォルトCSS
function getDefaultCss(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif; line-height: 1.8; color: #333; }
@media (max-width: 768px) {
  section { padding: 60px 20px !important; }
}
`
}

// LPのHTMLをリファイン（修正指示で更新）
export async function refineLPHTML(
  currentHtml: string,
  currentCss: string,
  instruction: string
): Promise<{ html: string; css: string }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return { html: currentHtml, css: currentCss }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  })

  const prompt = `以下のLP HTML/CSSを、指示に従って修正してください。

## 現在のHTML
\`\`\`html
${currentHtml}
\`\`\`

## 現在のCSS
\`\`\`css
${currentCss}
\`\`\`

## 修正指示
${instruction}

修正後のHTML/CSSを出力してください：

\`\`\`html
<!-- 修正後のHTML -->
\`\`\`

\`\`\`css
/* 修正後のCSS */
\`\`\`
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    const htmlMatch = text.match(/```html\s*([\s\S]*?)```/)
    const cssMatch = text.match(/```css\s*([\s\S]*?)```/)

    return {
      html: htmlMatch ? htmlMatch[1].trim() : currentHtml,
      css: cssMatch ? cssMatch[1].trim() : currentCss,
    }
  } catch {
    return { html: currentHtml, css: currentCss }
  }
}
