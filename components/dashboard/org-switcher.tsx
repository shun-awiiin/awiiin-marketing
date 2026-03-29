"use client";

import { useState } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function OrgSwitcher() {
  const { currentOrg, organizations, isLoading, switchOrg, refresh } =
    useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });

      if (res.ok) {
        const { data } = await res.json();
        await refresh();
        switchOrg(data.id);
        setCreateDialogOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleNameChange = (value: string) => {
    setNewOrgName(value);
    // Auto-generate slug from name
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setNewOrgSlug(slug);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" className="w-full">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="truncate font-semibold">
                {currentOrg?.name || "組織を選択"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {currentOrg?.slug || ""}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
          align="start"
          sideOffset={4}
        >
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => switchOrg(org.id)}
              className="flex items-center gap-2"
            >
              <Building2 className="size-4 shrink-0" />
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="truncate text-sm">{org.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {org.membership.role === "owner"
                    ? "オーナー"
                    : org.membership.role === "admin"
                      ? "管理者"
                      : "メンバー"}
                </span>
              </div>
              {currentOrg?.id === org.id && (
                <Check className="ml-auto size-4 shrink-0" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            新しい組織を作成
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しい組織を作成</DialogTitle>
            <DialogDescription>
              チームで利用する新しい組織を作成します。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">組織名</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Awiiin チーム"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-slug">スラッグ</Label>
              <Input
                id="org-slug"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                placeholder="awiiin-team"
              />
              <p className="text-xs text-muted-foreground">
                英小文字、数字、ハイフンのみ使用可能
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newOrgName.trim() || !newOrgSlug.trim()}
            >
              {isCreating ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
