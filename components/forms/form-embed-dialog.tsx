"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, Copy } from "lucide-react"
import type { StandaloneForm } from "@/lib/types/forms"

interface FormEmbedDialogProps {
  form: StandaloneForm
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return ""
}

export function FormEmbedDialog({
  form,
  open,
  onOpenChange,
}: FormEmbedDialogProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const baseUrl = getBaseUrl()
  const formUrl = `${baseUrl}/f/${form.slug}`

  const iframeCode = `<iframe
  src="${formUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 640px;"
  title="${form.name}"
></iframe>`

  const scriptCode = `<div id="mf-form-${form.slug}"></div>
<script>
(function() {
  var container = document.getElementById("mf-form-${form.slug}");
  var iframe = document.createElement("iframe");
  iframe.src = "${formUrl}";
  iframe.width = "100%";
  iframe.height = "600";
  iframe.style.border = "none";
  iframe.style.maxWidth = "640px";
  iframe.title = "${form.name}";
  container.appendChild(iframe);
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "mf-resize" && e.data.slug === "${form.slug}") {
      iframe.height = e.data.height;
    }
  });
})();
</script>`

  const handleCopy = useCallback(
    async (key: string, text: string) => {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    },
    []
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>埋め込みコード</DialogTitle>
          <DialogDescription>
            フォームをウェブサイトに埋め込むためのコードです。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="iframe" className="flex-1">
              iframe
            </TabsTrigger>
            <TabsTrigger value="script" className="flex-1">
              スクリプト
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              リンク
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-3">
            <Label>iframe埋め込みコード</Label>
            <Textarea
              readOnly
              value={iframeCode}
              rows={6}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleCopy("iframe", iframeCode)}
            >
              {copied === "iframe" ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {copied === "iframe" ? "コピーしました" : "コピー"}
            </Button>
          </TabsContent>

          <TabsContent value="script" className="space-y-3">
            <Label>スクリプト埋め込みコード</Label>
            <Textarea
              readOnly
              value={scriptCode}
              rows={8}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleCopy("script", scriptCode)}
            >
              {copied === "script" ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {copied === "script" ? "コピーしました" : "コピー"}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-3">
            <Label>フォームURL</Label>
            <Textarea
              readOnly
              value={formUrl}
              rows={2}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleCopy("link", formUrl)}
            >
              {copied === "link" ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {copied === "link" ? "コピーしました" : "コピー"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
