"use client";

import { useState } from "react";
import type {
  OrganizationMemberWithUser,
  OrgMemberRole,
} from "@/lib/types/organization";
import { getOrgRoleLabel } from "@/lib/types/organization";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface OrgMembersListProps {
  orgId: string;
  members: OrganizationMemberWithUser[];
  currentUserId: string;
  currentUserRole: OrgMemberRole;
  onRoleChange: (memberId: string, role: OrgMemberRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

const roleBadgeVariant: Record<
  OrgMemberRole,
  "default" | "secondary" | "outline" | "destructive"
> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  viewer: "outline",
};

export function OrgMembersList({
  orgId,
  members,
  currentUserId,
  currentUserRole,
  onRoleChange,
  onRemove,
}: OrgMembersListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  // Suppress unused variable warning - orgId reserved for future use
  void orgId;

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleRoleChange = async (memberId: string, role: OrgMemberRole) => {
    setChangingRoleId(memberId);
    try {
      await onRoleChange(memberId, role);
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemove = async () => {
    if (!removingId) return;
    try {
      await onRemove(removingId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ユーザー</TableHead>
            <TableHead>メールアドレス</TableHead>
            <TableHead>権限</TableHead>
            {canManage && <TableHead className="w-16" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const user = member.user as unknown as {
              id: string;
              email: string;
              display_name: string | null;
            };
            const isOwner = member.role === "owner";
            const isSelf = user.id === currentUserId;
            const canEdit = canManage && !isOwner && !isSelf;

            return (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {user.display_name || user.email.split("@")[0]}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (自分)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value as OrgMemberRole)
                      }
                      disabled={changingRoleId === member.id}
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
                  ) : (
                    <Badge variant={roleBadgeVariant[member.role]}>
                      {getOrgRoleLabel(member.role)}
                    </Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemovingId(member.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog
        open={removingId !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メンバーを削除</AlertDialogTitle>
            <AlertDialogDescription>
              このメンバーを組織から削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
