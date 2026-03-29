"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import type {
  OrganizationMemberWithUser,
  OrgMemberRole,
} from "@/lib/types/organization";
import { hasOrgRole } from "@/lib/types/organization";
import { OrgMembersList } from "@/components/settings/org-members-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

export default function OrganizationSettingsPage() {
  const { currentOrg, refresh: refreshOrg } = useOrganization();
  const currentUser = useCurrentUser();
  const { toast } = useToast();
  const orgFetch = useOrgFetch();

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>("member");
  const [isInviting, setIsInviting] = useState(false);

  const myRole = currentOrg?.membership.role ?? "viewer";
  const canEdit = hasOrgRole(myRole, "admin");

  // Load org details into form
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setOrgSlug(currentOrg.slug);
    }
  }, [currentOrg]);

  // Load members
  const loadMembers = useCallback(async () => {
    if (!currentOrg) return;
    setIsLoadingMembers(true);
    try {
      const res = await orgFetch(
        `/api/organizations/${currentOrg.id}/members`
      );
      if (res.ok) {
        const json = await res.json();
        setMembers(json.data || []);
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSaveOrg = async () => {
    if (!currentOrg || !canEdit) return;
    setIsSaving(true);
    try {
      const res = await orgFetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });

      if (res.ok) {
        toast({ title: "組織情報を更新しました" });
        await refreshOrg();
      } else {
        const json = await res.json();
        toast({
          title: "エラー",
          description: json.error,
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await orgFetch(
        `/api/organizations/${currentOrg.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        toast({
          title: "招待完了",
          description: json.message || "メンバーを追加しました",
        });
        setInviteEmail("");
        setInviteRole("member");
        await loadMembers();
      } else {
        const json = await res.json();
        toast({
          title: "エラー",
          description: json.error,
          variant: "destructive",
        });
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: OrgMemberRole) => {
    if (!currentOrg) return;
    const res = await orgFetch(
      `/api/organizations/${currentOrg.id}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }
    );

    if (res.ok) {
      toast({ title: "権限を変更しました" });
      await loadMembers();
    } else {
      const json = await res.json();
      toast({
        title: "エラー",
        description: json.error,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentOrg) return;
    const res = await orgFetch(
      `/api/organizations/${currentOrg.id}/members/${memberId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      toast({ title: "メンバーを削除しました" });
      await loadMembers();
    } else {
      const json = await res.json();
      toast({
        title: "エラー",
        description: json.error,
        variant: "destructive",
      });
    }
  };

  if (!currentOrg) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">組織設定</h2>
        <p className="text-muted-foreground">
          組織の基本情報とメンバーを管理します。
        </p>
      </div>

      <Separator />

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>組織名やスラッグを変更できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-org-name">組織名</Label>
            <Input
              id="settings-org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-org-slug">スラッグ</Label>
            <Input
              id="settings-org-slug"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          {canEdit && (
            <Button onClick={handleSaveOrg} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Invite Member */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>メンバーを招待</CardTitle>
            <CardDescription>
              メールアドレスでメンバーを追加します。未登録の場合はアカウントが自動作成され、招待メールが送信されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 grid gap-2">
                <Label htmlFor="invite-email">メールアドレス</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>権限</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as OrgMemberRole)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理者</SelectItem>
                    <SelectItem value="member">メンバー</SelectItem>
                    <SelectItem value="viewer">閲覧者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}
              >
                {isInviting ? "追加中..." : "追加"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
          <CardDescription>
            現在の組織メンバーと権限を確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <OrgMembersList
              orgId={currentOrg.id}
              members={members}
              currentUserId={currentUser.id}
              currentUserRole={myRole}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveMember}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
