"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagAssignDialogProps {
  contactIds: string[];
  tags: Tag[];
  onComplete: () => void;
  onClose: () => void;
}

export function TagAssignDialog({
  contactIds,
  tags,
  onComplete,
  onClose,
}: TagAssignDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleAssign = async () => {
    if (selectedTags.length === 0) return;
    setLoading(true);

    const insertData = contactIds.flatMap((contactId) =>
      selectedTags.map((tagId) => ({
        contact_id: contactId,
        tag_id: tagId,
      }))
    );

    const { error } = await supabase
      .from("contact_tags")
      .upsert(insertData, { onConflict: "contact_id,tag_id" });

    if (!error) {
      onComplete();
    }
    setLoading(false);
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>タグを付ける</DialogTitle>
        <DialogDescription>
          {contactIds.length}件の連絡先にタグを付けます
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 py-4 max-h-64 overflow-y-auto">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            タグがありません。先にタグを作成してください。
          </p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3">
              <Checkbox
                id={tag.id}
                checked={selectedTags.includes(tag.id)}
                onCheckedChange={() => toggleTag(tag.id)}
              />
              <Label htmlFor={tag.id} className="flex items-center gap-2 cursor-pointer">
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                </Badge>
              </Label>
            </div>
          ))
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleAssign}
          disabled={selectedTags.length === 0 || loading}
        >
          {loading ? "適用中..." : "タグを適用"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
