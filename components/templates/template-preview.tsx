"use client";

import { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface Template {
  id: string;
  name: string;
  subject: string;
  body_text: string;
  body_html: string | null;
}

interface TemplatePreviewProps {
  template: Template;
  onClose: () => void;
}

const defaultVariables = {
  name: "山田 太郎",
  company: "株式会社サンプル",
  event_name: "AIビジネス活用セミナー",
  event_date: "2026年2月15日（土）14:00〜16:00",
  event_location: "オンライン（Zoom）",
  registration_url: "https://example.com/register",
};

export function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  const [variables, setVariables] = useState(defaultVariables);

  const replacePlaceholders = (text: string) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    });
    return result;
  };

  const previewSubject = replacePlaceholders(template.subject);
  const previewBody = replacePlaceholders(template.body_text);

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>テンプレートプレビュー</DialogTitle>
        <DialogDescription>{template.name}</DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">プレビュー</TabsTrigger>
          <TabsTrigger value="variables">変数設定</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">件名:</span>
                <span className="font-medium">{previewSubject}</span>
              </div>
            </div>
            <Separator />
            <div className="p-4 bg-background">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {previewBody}
              </pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="variables" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-name">受信者名 {"{name}"}</Label>
              <Input
                id="var-name"
                value={variables.name}
                onChange={(e) =>
                  setVariables({ ...variables, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-company">会社名 {"{company}"}</Label>
              <Input
                id="var-company"
                value={variables.company}
                onChange={(e) =>
                  setVariables({ ...variables, company: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-event-name">イベント名 {"{event_name}"}</Label>
              <Input
                id="var-event-name"
                value={variables.event_name}
                onChange={(e) =>
                  setVariables({ ...variables, event_name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-event-date">日時 {"{event_date}"}</Label>
              <Input
                id="var-event-date"
                value={variables.event_date}
                onChange={(e) =>
                  setVariables({ ...variables, event_date: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-event-location">
                場所 {"{event_location}"}
              </Label>
              <Input
                id="var-event-location"
                value={variables.event_location}
                onChange={(e) =>
                  setVariables({ ...variables, event_location: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="var-registration-url">
                登録URL {"{registration_url}"}
              </Label>
              <Input
                id="var-registration-url"
                value={variables.registration_url}
                onChange={(e) =>
                  setVariables({
                    ...variables,
                    registration_url: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          閉じる
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
