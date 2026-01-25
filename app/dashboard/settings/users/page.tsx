"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Shield, Users, AlertCircle, CheckCircle } from "lucide-react";
import { UserRole } from "@/lib/types/database";
import { useCurrentUser, hasRole } from "@/lib/hooks/use-current-user";
import { ClientDate } from "@/components/ui/client-date";

interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    userId: string;
    newRole: UserRole;
    email: string;
  } | null>(null);

  const currentUser = useCurrentUser();
  const router = useRouter();
  const supabase = createClient();

  // Redirect if not admin
  useEffect(() => {
    if (!currentUser.isLoading && !hasRole(currentUser.role, "admin")) {
      router.push("/dashboard/settings");
    }
  }, [currentUser.isLoading, currentUser.role, router]);

  const fetchUsers = async () => {
    setLoading(true);
    const response = await fetch("/api/users");
    const data = await response.json();

    if (response.ok) {
      setUsers(data.data);
      setError(null);
    } else {
      setError(data.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser.role === "admin") {
      fetchUsers();
    }
  }, [currentUser.role]);

  const handleRoleChange = (userId: string, newRole: UserRole, email: string) => {
    // Prevent changing own role
    if (userId === currentUser.id) {
      setMessage({ type: "error", text: "自分のロールは変更できません" });
      return;
    }

    setPendingChange({ userId, newRole, email });
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;

    const response = await fetch(`/api/users/${pendingChange.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: pendingChange.newRole }),
    });

    const data = await response.json();

    if (response.ok) {
      setMessage({ type: "success", text: `${pendingChange.email}のロールを${pendingChange.newRole}に変更しました` });
      fetchUsers();
    } else {
      setMessage({ type: "error", text: data.error });
    }

    setPendingChange(null);
  };

  const roleConfig: Record<UserRole, { label: string; color: string; description: string }> = {
    admin: {
      label: "管理者",
      color: "bg-red-100 text-red-700",
      description: "全ての操作が可能",
    },
    editor: {
      label: "編集者",
      color: "bg-blue-100 text-blue-700",
      description: "キャンペーンの作成・編集・送信が可能",
    },
    viewer: {
      label: "閲覧者",
      color: "bg-gray-100 text-gray-700",
      description: "閲覧のみ可能",
    },
  };

  if (currentUser.isLoading || (!currentUser.isLoading && !hasRole(currentUser.role, "admin"))) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <p className="text-muted-foreground">
          ユーザーのロールと権限を管理します
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            権限レベル
          </CardTitle>
          <CardDescription>
            各ロールで実行できる操作の一覧
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(roleConfig) as UserRole[]).map((role) => (
              <div key={role} className="p-4 border rounded-lg">
                <Badge className={roleConfig[role].color}>
                  {roleConfig[role].label}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  {roleConfig[role].description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ユーザー一覧
          </CardTitle>
          <CardDescription>
            登録済みユーザーのロールを変更できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">読み込み中...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>登録日</TableHead>
                  <TableHead>ロール</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.email}
                      {user.id === currentUser.id && (
                        <Badge variant="outline" className="ml-2">
                          あなた
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{user.display_name || "-"}</TableCell>
                    <TableCell>
                      <ClientDate date={user.created_at} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          handleRoleChange(user.id, value as UserRole, user.email)
                        }
                        disabled={user.id === currentUser.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">管理者</SelectItem>
                          <SelectItem value="editor">編集者</SelectItem>
                          <SelectItem value="viewer">閲覧者</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingChange} onOpenChange={() => setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ロールを変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.email} のロールを{" "}
              <strong>{pendingChange && roleConfig[pendingChange.newRole].label}</strong>{" "}
              に変更します。この操作は取り消せます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>変更する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
