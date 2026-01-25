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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageCircle, Copy, ExternalLink, CheckCircle } from 'lucide-react'
import {
  generateWhatsAppDMText,
  generateSupportDMText,
  getSupportTemplates,
  WHATSAPP_WEB_URL,
  WHATSAPP_MESSAGE_LIMITS,
  type WhatsAppDMParams,
  type SupportTemplateType,
} from '@/lib/social/whatsapp-dm-generator'
import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

interface WhatsAppDMCardProps {
  campaignId: string
  campaignType: TemplateType
  inputPayload: SeminarInvitePayload | FreeTrialInvitePayload
}

export function WhatsAppDMCard({
  campaignId,
  campaignType,
  inputPayload,
}: WhatsAppDMCardProps) {
  // Campaign DM params
  const [dmParams, setDmParams] = useState<WhatsAppDMParams>({
    customer_name: '',
    seminar_description: 'eBay物販に関する実践的なノウハウをお伝えします',
  })

  // Support DM params
  const [supportTemplateType, setSupportTemplateType] = useState<SupportTemplateType>('inquiry_received')
  const [supportParams, setSupportParams] = useState<WhatsAppDMParams>({
    customer_name: '',
    response_content: '',
  })

  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supportTemplates = getSupportTemplates()

  // Generate campaign DM text
  const campaignDMText = useMemo(() => {
    return generateWhatsAppDMText(campaignType, inputPayload, dmParams)
  }, [campaignType, inputPayload, dmParams])

  // Generate support DM text
  const supportDMText = useMemo(() => {
    return generateSupportDMText(supportTemplateType, supportParams)
  }, [supportTemplateType, supportParams])

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setError(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }, [])

  // Open WhatsApp Web
  const handleOpenWhatsApp = useCallback(() => {
    window.open(WHATSAPP_WEB_URL, '_blank')
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          WhatsApp DM
        </CardTitle>
        <CardDescription>
          キャンペーン内容や顧客対応用のDM文書を生成します。
          コピーしてWhatsAppに貼り付けてください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="campaign">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campaign">キャンペーン案内</TabsTrigger>
            <TabsTrigger value="support">顧客対応</TabsTrigger>
          </TabsList>

          {/* Campaign DM Tab */}
          <TabsContent value="campaign" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">お客様名</Label>
                <Input
                  id="customer_name"
                  value={dmParams.customer_name ?? ''}
                  onChange={(e) =>
                    setDmParams((prev) => ({
                      ...prev,
                      customer_name: e.target.value,
                    }))
                  }
                  placeholder="お客様"
                />
              </div>
              {campaignType === 'SEMINAR_INVITE' && (
                <div className="space-y-2">
                  <Label htmlFor="seminar_desc">セミナー説明</Label>
                  <Input
                    id="seminar_desc"
                    value={dmParams.seminar_description ?? ''}
                    onChange={(e) =>
                      setDmParams((prev) => ({
                        ...prev,
                        seminar_description: e.target.value,
                      }))
                    }
                    placeholder="eBay物販に関する実践的なノウハウをお伝えします"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>生成されたDM</Label>
                <span
                  className={`text-sm ${
                    campaignDMText.length > WHATSAPP_MESSAGE_LIMITS.maxCharacters
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                  }`}
                >
                  {campaignDMText.length} / {WHATSAPP_MESSAGE_LIMITS.maxCharacters} 文字
                </span>
              </div>
              <Textarea
                value={campaignDMText}
                readOnly
                rows={12}
                className="font-mono text-sm resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={copied ? 'default' : 'outline'}
                onClick={() => handleCopy(campaignDMText)}
                className="gap-2"
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
              <Button variant="outline" onClick={handleOpenWhatsApp} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                WhatsApp Webを開く
              </Button>
            </div>
          </TabsContent>

          {/* Support DM Tab */}
          <TabsContent value="support" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support_customer_name">お客様名</Label>
                <Input
                  id="support_customer_name"
                  value={supportParams.customer_name ?? ''}
                  onChange={(e) =>
                    setSupportParams((prev) => ({
                      ...prev,
                      customer_name: e.target.value,
                    }))
                  }
                  placeholder="お客様"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_template">テンプレート</Label>
                <Select
                  value={supportTemplateType}
                  onValueChange={(value) => setSupportTemplateType(value as SupportTemplateType)}
                >
                  <SelectTrigger id="support_template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {supportTemplateType === 'inquiry_received' && (
              <div className="space-y-2">
                <Label htmlFor="response_content">回答内容</Label>
                <Textarea
                  id="response_content"
                  value={supportParams.response_content ?? ''}
                  onChange={(e) =>
                    setSupportParams((prev) => ({
                      ...prev,
                      response_content: e.target.value,
                    }))
                  }
                  placeholder="お問い合わせへの回答内容を入力してください"
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>生成されたDM</Label>
                <span
                  className={`text-sm ${
                    supportDMText.length > WHATSAPP_MESSAGE_LIMITS.maxCharacters
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                  }`}
                >
                  {supportDMText.length} / {WHATSAPP_MESSAGE_LIMITS.maxCharacters} 文字
                </span>
              </div>
              <Textarea
                value={supportDMText}
                readOnly
                rows={10}
                className="font-mono text-sm resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={copied ? 'default' : 'outline'}
                onClick={() => handleCopy(supportDMText)}
                className="gap-2"
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
              <Button variant="outline" onClick={handleOpenWhatsApp} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                WhatsApp Webを開く
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg mt-4">
          <p className="font-medium mb-1">使い方</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>お客様名を入力（任意）</li>
            <li>必要に応じてテンプレートや内容を選択</li>
            <li>「テキストをコピー」をクリック</li>
            <li>「WhatsApp Webを開く」でWhatsAppに移動</li>
            <li>対象のチャットにテキストを貼り付けて送信</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
