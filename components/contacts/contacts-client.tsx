"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Search,
  MoreHorizontal,
  Trash2,
  Tag,
  Download,
  UserPlus,
  ListIcon,
} from "lucide-react";
import { CSVImportDialog } from "./csv-import-dialog";
import { TagAssignDialog } from "./tag-assign-dialog";
import { ListAssignDialog } from "./list-assign-dialog";

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  status: string;
  created_at: string;
  tags: { id: string; name: string; color: string }[];
}

interface ContactsClientProps {
  initialContacts: Contact[];
  tags: { id: string; name: string; color: string }[];
  userId: string;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function ContactsClient({
  initialContacts,
  tags,
  userId,
  totalCount,
  currentPage,
  pageSize,
}: ContactsClientProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    email: "",
    first_name: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleAddContact = async () => {
    if (!newContact.email) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        email: newContact.email,
        first_name: newContact.first_name || null,
        company: newContact.company || null,
      })
      .select()
      .single();

    if (!error && data) {
      setContacts([{ ...data, tags: [] }, ...contacts]);
      setNewContact({ email: "", first_name: "", company: "" });
      setIsAddDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (!error) {
      setContacts(contacts.filter((c) => c.id !== id));
      setSelectedContacts(selectedContacts.filter((sid) => sid !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;

    const { error } = await supabase
      .from("contacts")
      .delete()
      .in("id", selectedContacts);

    if (!error) {
      setContacts(contacts.filter((c) => !selectedContacts.includes(c.id)));
      setSelectedContacts([]);
    }
  };

  const toggleSelectAll = () => {
    const pageIds = filteredContacts.map((c) => c.id);
    const allSelectedOnPage = pageIds.every((id) =>
      selectedContacts.includes(id)
    );
    if (allSelectedOnPage) {
      setSelectedContacts(selectedContacts.filter((id) => !pageIds.includes(id)));
    } else {
      const next = new Set([...selectedContacts, ...pageIds]);
      setSelectedContacts(Array.from(next));
    }
  };

  const toggleSelectContact = (id: string) => {
    if (selectedContacts.includes(id)) {
      setSelectedContacts(selectedContacts.filter((sid) => sid !== id));
    } else {
      setSelectedContacts([...selectedContacts, id]);
    }
  };

  const handleImportComplete = useCallback(() => {
    router.refresh();
    setIsImportDialogOpen(false);
  }, [router]);

  const handleTagAssignComplete = useCallback(() => {
    router.refresh();
    setIsTagDialogOpen(false);
    setSelectedContacts([]);
  }, [router]);

  const exportCSV = () => {
    const headers = ["email", "firstName", "company", "status", "tags"];
    const rows = contacts.map((c) => [
      c.email,
      c.first_name || "",
      c.company || "",
      c.status,
      c.tags.map((t) => t.name).join(";"),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">連絡先</h1>
          <p className="text-muted-foreground">
            全{totalCount}件中{filteredContacts.length}件表示
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            エクスポート
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                CSVインポート
              </Button>
            </DialogTrigger>
            <CSVImportDialog
              userId={userId}
              onComplete={handleImportComplete}
              onClose={() => setIsImportDialogOpen(false)}
            />
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                連絡先を追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>連絡先を追加</DialogTitle>
                <DialogDescription>
                  新しい連絡先の情報を入力してください
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={newContact.email}
                    onChange={(e) =>
                      setNewContact({ ...newContact, email: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="first_name">名前</Label>
                  <Input
                    id="first_name"
                    placeholder="太郎"
                    value={newContact.first_name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="company">会社名</Label>
                  <Input
                    id="company"
                    placeholder="株式会社サンプル"
                    value={newContact.company}
                    onChange={(e) =>
                      setNewContact({ ...newContact, company: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleAddContact} disabled={loading}>
                  {loading ? "追加中..." : "追加"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="メール、名前、会社名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedContacts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedContacts.length}件選択中
            </span>
            <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="mr-2 h-4 w-4" />
                  タグを付ける
                </Button>
              </DialogTrigger>
              <TagAssignDialog
                contactIds={selectedContacts}
                tags={tags}
                onComplete={handleTagAssignComplete}
                onClose={() => setIsTagDialogOpen(false)}
              />
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsListDialogOpen(true)}
            >
              <ListIcon className="mr-2 h-4 w-4" />
              リストに追加
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              削除
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredContacts.length > 0 &&
                    filteredContacts.every((c) => selectedContacts.includes(c.id))
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>会社名</TableHead>
              <TableHead>タグ</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <UserPlus className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">連絡先がありません</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleSelectContact(contact.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contact.email}</TableCell>
                  <TableCell>{contact.first_name || "-"}</TableCell>
                  <TableCell>{contact.company || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contact.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContacts([contact.id]);
                            setIsTagDialogOpen(true);
                          }}
                        >
                          <Tag className="mr-2 h-4 w-4" />
                          タグを付ける
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContacts([contact.id]);
                            setIsListDialogOpen(true);
                          }}
                        >
                          <ListIcon className="mr-2 h-4 w-4" />
                          リストに追加
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            ページ {currentPage} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => router.push(`/dashboard/contacts?page=${currentPage - 1}`)}
            >
              前へ
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => router.push(`/dashboard/contacts?page=${currentPage + 1}`)}
            >
              次へ
            </Button>
          </div>
        </div>
      )}

      <ListAssignDialog
        contactIds={selectedContacts}
        open={isListDialogOpen}
        onClose={() => setIsListDialogOpen(false)}
        onComplete={() => {
          setSelectedContacts([]);
          router.refresh();
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: "有効", className: "bg-green-100 text-green-700" },
    unsubscribed: { label: "配信停止", className: "bg-red-100 text-red-700" },
    bounced: { label: "バウンス", className: "bg-orange-100 text-orange-700" },
  };

  const config = statusConfig[status] || statusConfig.active;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
