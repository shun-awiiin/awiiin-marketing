import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { LPBlock, LPGenerationInput, BlockType } from '@/lib/types/landing-page'

// Gemini API設定
const MODEL_TEXT = 'gemini-2.0-flash' // 高速・低コスト
const MODEL_TEXT_PRO = 'gemini-1.5-pro' // 高品質（オプション）

// システムプロンプト：専門家ペルソナ
const SYSTEM_PROMPT = `あなたは、コンバージョン率を最大化することを専門とする経験豊富なWebデザイナー兼コピーライターです。
日本の消費者心理を熟知し、説得力のあるランディングページを作成することに長けています。

## あなたの専門性
- 10年以上のLP制作経験
- 300件以上のLP制作実績
- 平均CVR 5%以上を達成
- PASONAの法則、AIDAモデルを熟知

## 生成ルール
1. すべてのコピーは日本語で書く
2. 読者の感情に訴えかける表現を使う
3. 具体的な数字やデータを含める
4. 緊急性・希少性を適切に表現する
5. ベネフィット（顧客が得られる価値）を強調する
6. 反論処理を含める
7. 社会的証明を活用する

## 文章スタイル
- 簡潔で力強い見出し
- 読みやすい短い文章
- 箇条書きの活用
- 共感を呼ぶ問いかけ
- 行動を促す明確なCTA`

// LPブロックのJSONスキーマ（構造化出力用）
const LP_BLOCKS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      description: 'LPを構成するブロックの配列',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: 'ブロックの一意識別子（UUID形式）',
          },
          type: {
            type: SchemaType.STRING,
            description: 'ブロックの種類',
            enum: ['hero', 'problem', 'solution', 'features', 'testimonials', 'pricing', 'bonus', 'faq', 'cta', 'form'],
          },
          content: {
            type: SchemaType.OBJECT,
            description: 'ブロックの内容（typeによって構造が異なる）',
          },
          settings: {
            type: SchemaType.OBJECT,
            description: 'ブロックの表示設定',
            properties: {
              padding: {
                type: SchemaType.STRING,
                enum: ['small', 'medium', 'large'],
              },
              width: {
                type: SchemaType.STRING,
                enum: ['narrow', 'medium', 'full'],
              },
              background_color: {
                type: SchemaType.STRING,
                description: '背景色（HEXコード）',
                nullable: true,
              },
            },
          },
          image_prompt: {
            type: SchemaType.STRING,
            description: 'このブロックに表示する画像を生成するためのプロンプト（将来のNano Banana連携用）',
            nullable: true,
          },
        },
        required: ['id', 'type', 'content', 'settings'],
      },
    },
  },
  required: ['blocks'],
}

// UUID生成
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// LP生成用の詳細プロンプト生成
function buildGenerationPrompt(input: LPGenerationInput): string {
  const parts: string[] = [
    '以下の情報に基づいて、高コンバージョンなランディングページを生成してください。',
    '',
    '## 商品/サービス情報',
    `- 商品名: ${input.product_name}`,
    `- ターゲット顧客: ${input.target_audience}`,
    `- 主な悩み・課題: ${input.main_problem}`,
    `- 提供する解決策: ${input.solution}`,
  ]

  if (input.price) {
    parts.push(`- 価格: ${input.price}`)
  }

  if (input.bonuses?.length) {
    parts.push(`- 特典: ${input.bonuses.join(', ')}`)
  }

  if (input.urgency) {
    parts.push(`- 限定性: ${input.urgency}`)
  }

  if (input.testimonials?.length) {
    parts.push('', '## お客様の声')
    input.testimonials.forEach((t, i) => {
      parts.push(`${i + 1}. ${t.name}: 「${t.quote}」`)
    })
  }

  parts.push(
    '',
    '## 生成するブロック構成',
    '以下の順序でブロックを生成してください：',
    '',
    '1. **hero** (必須): キャッチーな見出しと行動喚起',
    '   - headline: 一目で価値が伝わる強力な見出し',
    '   - subheadline: 補足説明（ターゲットの悩みに寄り添う）',
    '   - cta_text: 行動を促すボタンテキスト',
    '   - cta_url: "#form"',
    '',
    '2. **problem** (必須): 読者の悩みを明確化',
    '   - title: 共感を呼ぶタイトル',
    '   - problems: 3-5個の具体的な悩み（配列）',
    '',
    '3. **solution** (必須): 解決策の提示',
    '   - title: 希望を与えるタイトル',
    '   - description: 解決策の説明',
    '   - bullets: 3-5個のポイント（配列）',
    '',
    '4. **features** (必須): 選ばれる理由',
    '   - title: セクションタイトル',
    '   - features: 3-4個の特徴（各項目にtitle, descriptionを含む配列）',
    '',
    '5. **testimonials** (お客様の声がある場合): 社会的証明',
    '   - title: セクションタイトル',
    '   - items: お客様の声（各項目にname, quote, roleを含む配列）',
    '',
    '6. **pricing** (価格がある場合): 料金プラン',
    '   - title: セクションタイトル',
    '   - plans: プラン情報（name, price, features配列, cta_text, cta_urlを含む）',
    '',
    '7. **bonus** (特典がある場合): 特典・ボーナス',
    '   - title: セクションタイトル',
    '   - bonuses: 特典情報（各項目にtitle, value, descriptionを含む配列）',
    '',
    '8. **faq** (推奨): よくある質問',
    '   - title: セクションタイトル',
    '   - items: 3-5個のQ&A（各項目にquestion, answerを含む配列）',
    '',
    '9. **cta** (必須): 最終行動喚起',
    '   - title: 緊急性を含むタイトル',
    '   - description: 最後の後押し',
    '   - button_text: 行動喚起テキスト',
    '   - button_url: "#form"',
    '   - urgency_text: 限定性の訴求（任意）',
    '',
    '10. **form** (必須): 申し込みフォーム',
    '    - title: フォームタイトル',
    '    - fields: name(text), email(email)フィールド（各項目にname, label, type, requiredを含む配列）',
    '    - submit_text: 送信ボタンテキスト',
    '',
    '## 重要な注意事項',
    '- 各ブロックのidは必ずUUID形式（例: "550e8400-e29b-41d4-a716-446655440000"）で生成',
    '- settingsには padding: "medium", width: "medium" をデフォルトで設定',
    '- heroブロックはpadding: "large", width: "full"',
    '- formブロックはpadding: "large", width: "narrow"',
    '- 日本語のコピーは簡潔で力強く、読者の心に響くものにする',
    '- image_promptには各ブロックに適した画像を生成するための詳細な指示を含める（日本語で記述）'
  )

  return parts.join('\n')
}

// メイン生成関数
export async function generateLPContent(input: LPGenerationInput): Promise<LPBlock[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    // APIキーがない場合はデフォルトテンプレートを返す
    return generateDefaultTemplate(input)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LP_BLOCKS_SCHEMA,
      temperature: 0.7, // 創造性と一貫性のバランス
    },
  })

  const prompt = buildGenerationPrompt(input)

  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // JSONをパース
    const parsed = JSON.parse(text)

    // バリデーションとUUID確認
    const blocks: LPBlock[] = parsed.blocks.map((block: Record<string, unknown>) => ({
      id: typeof block.id === 'string' && block.id.length > 0 ? block.id : generateUUID(),
      type: block.type as BlockType,
      content: block.content || {},
      settings: block.settings || { padding: 'medium', width: 'medium' },
    }))

    return blocks
  } catch (error) {
    // エラー時はデフォルトテンプレートにフォールバック
    return generateDefaultTemplate(input)
  }
}

// 対話微調整用の関数
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
    systemInstruction: `${SYSTEM_PROMPT}

## 微調整モード
ユーザーの指示に従って、既存のLPブロックを更新してください。
- 指示された部分のみを変更
- 他の部分は変更しない
- ブロックのid、type、settingsは可能な限り維持
- 新しいブロックを追加する場合は適切な位置に挿入`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LP_BLOCKS_SCHEMA,
      temperature: 0.5, // 微調整は一貫性重視
    },
  })

  const prompt = `## 現在のLPブロック
${JSON.stringify(currentBlocks, null, 2)}

## ユーザーの指示
${instruction}

上記の指示に従って、LPブロックを更新してください。`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    const parsed = JSON.parse(text)
    return parsed.blocks as LPBlock[]
  } catch {
    return currentBlocks
  }
}

// デフォルトテンプレート生成
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
          '費用対効果が心配',
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
          '初心者でも簡単に始められる',
          '確実に結果が出る仕組み',
          '充実したサポート体制',
          '返金保証付きで安心',
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
          {
            title: '圧倒的な実績',
            description: '多くのお客様に選ばれ、高い満足度を獲得しています。',
          },
          {
            title: '手厚いサポート',
            description: '専門スタッフが丁寧にサポート。初めての方も安心です。',
          },
          {
            title: '確かな効果',
            description: '科学的根拠に基づいた方法で、確実な成果を実感できます。',
          },
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    },
  ]

  // お客様の声を追加
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

  // 料金プランを追加
  if (input.price) {
    blocks.push({
      id: generateUUID(),
      type: 'pricing',
      content: {
        title: '料金プラン',
        plans: [
          {
            name: 'スタンダードプラン',
            price: input.price,
            features: [
              '全機能利用可能',
              'サポート付き',
              '30日間返金保証',
            ],
            cta_text: '今すぐ申し込む',
            cta_url: '#form',
          },
        ],
      },
      settings: { padding: 'medium', width: 'medium' },
    })
  }

  // 特典を追加
  if (input.bonuses?.length) {
    blocks.push({
      id: generateUUID(),
      type: 'bonus',
      content: {
        title: '今だけの限定特典',
        bonuses: input.bonuses.map((b, i) => ({
          title: `特典${i + 1}`,
          value: '非売品',
          description: b,
        })),
      },
      settings: { padding: 'medium', width: 'medium' },
    })
  }

  // FAQを追加
  blocks.push({
    id: generateUUID(),
    type: 'faq',
    content: {
      title: 'よくある質問',
      items: [
        {
          question: '初心者でも大丈夫ですか？',
          answer: 'はい、初めての方でも分かりやすいように設計されています。サポートも充実しているのでご安心ください。',
        },
        {
          question: '返金はできますか？',
          answer: 'はい、ご満足いただけない場合は30日間の返金保証がございます。',
        },
        {
          question: 'どのくらいで効果が出ますか？',
          answer: '個人差はありますが、多くの方が1ヶ月以内に効果を実感されています。',
        },
      ],
    },
    settings: { padding: 'medium', width: 'medium' },
  })

  // CTAを追加
  blocks.push({
    id: generateUUID(),
    type: 'cta',
    content: {
      title: '今すぐ始めましょう',
      description: input.urgency || 'この機会をお見逃しなく。あなたの未来が変わります。',
      button_text: '今すぐ申し込む',
      button_url: '#form',
    },
    settings: { padding: 'large', width: 'medium' },
  })

  // フォームを追加
  blocks.push({
    id: generateUUID(),
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
  })

  return blocks
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

// 将来のNano Banana画像生成用（準備）
export async function generateLPImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  // TODO: Nano Banana (gemini-2.5-flash-image) が利用可能になったら実装
  // 現時点ではプレースホルダー
  return null
}
