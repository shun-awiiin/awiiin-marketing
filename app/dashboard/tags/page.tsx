"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag, Users } from "lucide-react";

interface TagWithCount {
  id: string;
  name: string;
  color: string;
  contact_count: number;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState({ name: "", color: PRESET_COLORS[0] });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tagsData } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (tagsData) {
      const tagsWithCount = await Promise.all(
        tagsData.map(async (tag) => {
          const { count } = await supabase
            .from("contact_tags")
            .select("*", { count: "exact", head: true })
            .eq("tag_id", tag.id);
          return { ...tag, contact_count: count ?? 0 };
        })
      );
      setTags(tagsWithCount);
    }
  };

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tags")
      .insert({
        user_id: user.id,
        name: newTag.name.trim(),
        color: newTag.color,
      })
      .select()
      .single();

    if (!error && data) {
      setTags([...tags, { ...data, contact_count: 0 }]);
      setNewTag({ name: "", color: PRESET_COLORS[0] });
      setIsDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDeleteTag = async (id: string) => {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (!error) {
      setTags(tags.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">タグ管理</h1>
          <p className="text-muted-foreground">
            連絡先をグループ化するためのタグを管理
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              タグを作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>タグを作成</DialogTitle>
              <DialogDescription>
                新しいタグの名前と色を設定してください
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">タグ名</Label>
                <Input
                  id="name"
                  placeholder="例: セミナー参加者"
                  value={newTag.name}
                  onChange={(e) =>
                    setNewTag({ ...newTag, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>色</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        newTag.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTag({ ...newTag, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label>プレビュー:</Label>
                <Badge
                  style={{
                    backgroundColor: newTag.color + "20",
                    color: newTag.color,
                  }}
                >
                  {newTag.name || "タグ名"}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreateTag} disabled={loading}>
                {loading ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              タグがまだありません
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              最初のタグを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Badge
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                  }}
                  className="text-sm"
                >
                  {tag.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteTag(tag.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{tag.contact_count}件の連絡先</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
