import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini API設定
const MODEL_TEXT = 'gemini-2.5-flash-preview-05-20'

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

export interface LPGenerationResult {
  html: string
  css: string
  title: string
  meta_description: string
}

// HTML生成用プロンプト
const HTML_GENERATION_PROMPT = `あなたは世界トップクラスのLP制作者です。
CVR（コンバージョン率）5%以上を実現する、圧倒的に強いLPのHTMLコードを生成してください。

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
- 適切な余白（padding/margin）
- 視線誘導を意識したレイアウト
- CTAボタンは目立つ色で大きく
- スマホ対応（レスポンシブ）

### LP構成（この順番で）
1. **ヒーロー**: キャッチコピー + サブコピー + CTA
2. **問題提起**: 「こんな悩みありませんか？」
3. **共感**: 「その気持ち、わかります」
4. **解決策**: 「だから○○を作りました」
5. **特徴/ベネフィット**: 3つのポイント
6. **お客様の声**（あれば）
7. **よくある質問**: 不安を払拭
8. **最終CTA**: 「今すぐ○○」

## 出力形式

HTMLとCSSを分けて出力してください。
Tailwind CSSは使わず、純粋なCSSで書いてください。
JavaScriptは最小限に。

\`\`\`html
<!-- ここにHTML -->
\`\`\`

\`\`\`css
/* ここにCSS */
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

export async function generateLPHTML(
  input: LPGenerationInput,
  imageAnalysis?: ImageAnalysisResult | null
): Promise<LPGenerationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return generateDefaultHTML(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,
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
- セクション構成: ${imageAnalysis.sections.map((s) => s.type).join(' → ')}
`
  }

  const prompt = `${HTML_GENERATION_PROMPT}

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

上記の情報を元に、圧倒的にコンバージョンするLPのHTML/CSSを生成してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // HTMLとCSSを抽出
    const htmlMatch = text.match(/```html\s*([\s\S]*?)```/)
    const cssMatch = text.match(/```css\s*([\s\S]*?)```/)

    const html = htmlMatch ? htmlMatch[1].trim() : generateDefaultHTML(input).html
    const css = cssMatch ? cssMatch[1].trim() : generateDefaultHTML(input).css

    return {
      html,
      css,
      title: input.product_name,
      meta_description: `${input.target_audience}のための${input.product_name}`,
    }
  } catch (error) {
    console.error('LP HTML generation error:', error)
    return generateDefaultHTML(input)
  }
}

// デフォルトHTML（APIエラー時のフォールバック）
function generateDefaultHTML(input: LPGenerationInput): LPGenerationResult {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${input.product_name}</title>
</head>
<body>
  <!-- Hero Section -->
  <section class="hero">
    <div class="hero-content">
      <h1 class="hero-title">${input.main_problem}を解決する</h1>
      <p class="hero-subtitle">${input.solution}</p>
      <a href="#form" class="cta-button">今すぐ申し込む</a>
    </div>
  </section>

  <!-- Problem Section -->
  <section class="problem">
    <h2>こんなお悩みありませんか？</h2>
    <ul class="problem-list">
      <li>${input.main_problem}</li>
      <li>解決方法が分からない</li>
      <li>時間がかかりすぎる</li>
    </ul>
  </section>

  <!-- Solution Section -->
  <section class="solution">
    <h2>その悩み、解決できます</h2>
    <p>${input.solution}</p>
    <div class="benefits">
      <div class="benefit-item">
        <h3>簡単スタート</h3>
        <p>初心者でも始められる</p>
      </div>
      <div class="benefit-item">
        <h3>確かな実績</h3>
        <p>多くの方が成果を出しています</p>
      </div>
      <div class="benefit-item">
        <h3>充実サポート</h3>
        <p>困ったときも安心</p>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta" id="form">
    <h2>今すぐ始めましょう</h2>
    <p class="price">${input.price || '無料'}</p>
    <a href="#" class="cta-button cta-large">申し込む</a>
  </section>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${input.product_name}</p>
  </footer>
</body>
</html>
`

  const css = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
  line-height: 1.8;
  color: #333;
}

/* Hero */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 100px 20px;
  text-align: center;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-content {
  max-width: 800px;
}

.hero-title {
  font-size: clamp(28px, 5vw, 48px);
  font-weight: bold;
  margin-bottom: 20px;
}

.hero-subtitle {
  font-size: clamp(16px, 3vw, 24px);
  margin-bottom: 40px;
  opacity: 0.9;
}

/* CTA Button */
.cta-button {
  display: inline-block;
  background: #ff6b6b;
  color: white;
  padding: 18px 48px;
  border-radius: 50px;
  text-decoration: none;
  font-size: 18px;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
}

.cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
}

.cta-large {
  padding: 24px 64px;
  font-size: 22px;
}

/* Sections */
section {
  padding: 80px 20px;
  max-width: 1000px;
  margin: 0 auto;
}

section h2 {
  font-size: clamp(24px, 4vw, 36px);
  text-align: center;
  margin-bottom: 40px;
  color: #333;
}

/* Problem */
.problem {
  background: #f8f9fa;
  max-width: 100%;
}

.problem-list {
  max-width: 600px;
  margin: 0 auto;
  list-style: none;
}

.problem-list li {
  padding: 20px;
  margin-bottom: 15px;
  background: white;
  border-left: 4px solid #ff6b6b;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

/* Solution */
.solution p {
  text-align: center;
  font-size: 18px;
  margin-bottom: 40px;
}

.benefits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
}

.benefit-item {
  background: white;
  padding: 40px 30px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.benefit-item h3 {
  color: #667eea;
  margin-bottom: 15px;
  font-size: 20px;
}

/* Final CTA */
.cta {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  max-width: 100%;
}

.cta h2 {
  color: white;
}

.price {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 30px;
}

/* Footer */
footer {
  background: #333;
  color: white;
  text-align: center;
  padding: 30px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    padding: 60px 20px;
    min-height: 60vh;
  }
  
  section {
    padding: 60px 20px;
  }
  
  .cta-button {
    padding: 16px 36px;
  }
}
`

  return {
    html,
    css,
    title: input.product_name,
    meta_description: `${input.target_audience}のための${input.product_name}`,
  }
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
