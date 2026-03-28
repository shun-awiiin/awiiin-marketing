"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailBlock, HeaderBlockContent } from "@/lib/types/email-editor";

interface HeaderBlockEditorProps {
  block: EmailBlock;
  onChange: (block: EmailBlock) => void;
}

export function HeaderBlockEditor({ block, onChange }: HeaderBlockEditorProps) {
  const content = block.content as unknown as HeaderBlockContent;

  const handleChange = (field: keyof HeaderBlockContent, value: string) => {
    onChange({
      ...block,
      content: { ...block.content, [field]: value },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`header-text-${block.id}`}>見出しテキスト</Label>
        <Input
          id={`header-text-${block.id}`}
          value={content.text}
          onChange={(e) => handleChange("text", e.target.value)}
          placeholder="見出しを入力"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label>レベル</Label>
          <Select
            value={content.level}
            onValueChange={(v) => handleChange("level", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">H1 (大)</SelectItem>
              <SelectItem value="h2">H2 (中)</SelectItem>
              <SelectItem value="h3">H3 (小)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>配置</Label>
          <Select
            value={content.align}
            onValueChange={(v) => handleChange("align", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">左揃え</SelectItem>
              <SelectItem value="center">中央</SelectItem>
              <SelectItem value="right">右揃え</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
