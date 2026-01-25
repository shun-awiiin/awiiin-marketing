'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Copy,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Package,
  CreditCard,
  MessageSquare,
} from 'lucide-react'
import {
  generateThankYouCard,
  generatePackageInsert,
  generatePostPurchaseMessage,
  checkEbayPolicyCompliance,
  getEbayTemplateTypes,
  type EbayTemplateParams,
  type TemplateLanguage,
  type EbayTemplateType,
} from '@/lib/social/ebay-template-generator'

export function EbayToolsClient() {
  // Store settings
  const [params, setParams] = useState<EbayTemplateParams>({
    storeName: '',
    instagramHandle: '',
    xHandle: '',
    youtubeChannel: '',
    discountCode: '',
    discountPercent: 10,
  })

  // Template settings
  const [selectedTemplate, setSelectedTemplate] = useState<EbayTemplateType>('thank_you_card')
  const [language, setLanguage] = useState<TemplateLanguage>('bilingual')

  // UI state
  const [copied, setCopied] = useState(false)

  const templateTypes = getEbayTemplateTypes()
  const currentTemplateInfo = templateTypes.find((t) => t.id === selectedTemplate)

  // Generate text based on selected template
  const generatedText = useMemo(() => {
    if (!params.storeName) {
      return '(ストア名を入力してください)'
    }

    switch (selectedTemplate) {
      case 'thank_you_card':
        return generateThankYouCard(params, language)
      case 'package_insert':
        return generatePackageInsert(params, language)
      case 'post_purchase_message':
        return generatePostPurchaseMessage(params, language)
      default:
        return ''
    }
  }, [selectedTemplate, params, language])

  // Policy compliance check
  const policyCheck = useMemo(() => {
    return checkEbayPolicyCompliance(generatedText)
  }, [generatedText])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Handle error silently
    }
  }, [generatedText])

  const getTemplateIcon = (type: EbayTemplateType) => {
    switch (type) {
      case 'thank_you_card':
        return <CreditCard className="h-4 w-4" />
      case 'package_insert':
        return <Package className="h-4 w-4" />
      case 'post_purchase_message':
        return <MessageSquare className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Policy Notice */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>eBayポリシー準拠</AlertTitle>
        <AlertDescription>
          このツールで生成されるテンプレートはeBayポリシーに準拠しています。
          商品同梱物（カード、チラシ）はeBayプラットフォーム外のため安全に使用できます。
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Panel */}
        <Card>
          <CardHeader>
            <CardTitle>設定</CardTitle>
            <CardDescription>
              ストア情報とSNSアカウントを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Store Name */}
            <div className="space-y-2">
              <Label htmlFor="storeName">ストア名 *</Label>
              <Input
                id="storeName"
                value={params.storeName}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, storeName: e.target.value }))
                }
                placeholder="Your eBay Store"
              />
            </div>

            {/* Social Accounts */}
            <div className="space-y-2">
              <Label>SNSアカウント</Label>
              <div className="grid gap-2">
                <Input
                  value={params.instagramHandle ?? ''}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, instagramHandle: e.target.value }))
                  }
                  placeholder="Instagram: @username"
                />
                <Input
                  value={params.xHandle ?? ''}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, xHandle: e.target.value }))
                  }
                  placeholder="X (Twitter): @username"
                />
                <Input
                  value={params.youtubeChannel ?? ''}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, youtubeChannel: e.target.value }))
                  }
                  placeholder="YouTube: チャンネル名"
                />
              </div>
            </div>

            {/* Discount Settings */}
            <div className="space-y-2">
              <Label>フォロワー特典（任意）</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={params.discountCode ?? ''}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, discountCode: e.target.value }))
                  }
                  placeholder="クーポンコード: SNS10"
                />
                <Input
                  type="number"
                  value={params.discountPercent ?? ''}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      discountPercent: parseInt(e.target.value) || undefined,
                    }))
                  }
                  placeholder="割引率: 10%"
                  min={1}
                  max={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                空欄の場合、割引セクションは表示されません
              </p>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>テンプレートタイプ</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(value) => setSelectedTemplate(value as EbayTemplateType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {getTemplateIcon(template.id)}
                        <span>{template.name}</span>
                        <Badge
                          variant={template.policyStatus === 'safe' ? 'default' : 'secondary'}
                          className="ml-2"
                        >
                          {template.policyStatus === 'safe' ? '安全' : '注意'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTemplateInfo && (
                <p className="text-xs text-muted-foreground">
                  {currentTemplateInfo.description}
                </p>
              )}
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <Label>言語</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as TemplateLanguage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="japanese">日本語</SelectItem>
                  <SelectItem value="bilingual">バイリンガル（両方）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>プレビュー</span>
              {currentTemplateInfo && (
                <Badge
                  variant={currentTemplateInfo.policyStatus === 'safe' ? 'default' : 'secondary'}
                  className="gap-1"
                >
                  {currentTemplateInfo.policyStatus === 'safe' ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                  {currentTemplateInfo.policyStatus === 'safe' ? 'ポリシー適合' : '注意が必要'}
                </Badge>
              )}
            </CardTitle>
            {currentTemplateInfo && (
              <CardDescription>{currentTemplateInfo.policyNote}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Policy Warnings */}
            {!policyCheck.isCompliant && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>ポリシー違反の可能性</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {policyCheck.violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {policyCheck.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>注意</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm">
                    {policyCheck.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Generated Text */}
            <div className="space-y-2">
              <Label>生成されたテキスト</Label>
              <Textarea
                value={generatedText}
                readOnly
                rows={16}
                className="font-mono text-sm resize-none"
              />
            </div>

            {/* Copy Button */}
            <Button
              variant={copied ? 'default' : 'outline'}
              onClick={handleCopy}
              className="w-full gap-2"
              disabled={!params.storeName}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  テキストをコピー
                </>
              )}
            </Button>

            {/* Usage Instructions */}
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">使い方</p>
              {selectedTemplate === 'thank_you_card' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>テキストをコピー</li>
                  <li>Canvaなどでカードデザインを作成</li>
                  <li>印刷して商品に同梱</li>
                </ol>
              )}
              {selectedTemplate === 'package_insert' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>テキストをコピー</li>
                  <li>A5/A6サイズでレイアウト</li>
                  <li>印刷して商品に同梱</li>
                </ol>
              )}
              {selectedTemplate === 'post_purchase_message' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>テキストをコピー</li>
                  <li>追跡番号と到着予定日を記入</li>
                  <li>eBayメッセージで購入者に送信</li>
                </ol>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
