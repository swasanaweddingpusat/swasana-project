"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Pencil, Trash2, Users, Plus } from "lucide-react";
import type { GroupsQueryResult, GroupQueryItem } from "@/lib/queries/groups";
import type { UsersQueryResult } from "@/lib/queries/users";
import { deleteGroup } from "@/actions/group";
import { GroupDrawer } from "./group-drawer";
import { cn } from "../../../../../../lib/utils";

interface GroupsTableProps {
  initialData: GroupsQueryResult;
  users: UsersQueryResult;
}

function getInitials(name: string | null | undefined, fallback: string) {
  if (name) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  }
  return fallback[0]?.toUpperCase() ?? "?";
}

export function GroupsTable({ initialData, users }: GroupsTableProps) {
  const [groups, setGroups] = useState(initialData);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupQueryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupQueryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleCreate() {
    setEditGroup(null);
    setDrawerOpen(true);
  }

  function handleEdit(group: GroupQueryItem) {
    setEditGroup(group);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteGroup(deleteTarget.id);
    setIsDeleting(false);
    if (result.success) {
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      toast.success("Grup berhasil dihapus.");
    } else {
      toast.error(result.error);
    }
    setDeleteTarget(null);
  }

  function handleSaved(group: GroupQueryItem, isEdit: boolean) {
    if (isEdit) {
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
    } else {
      setGroups((prev) => [...prev, group]);
    }
  }

  return (
    <>
      <div className={cn('flex', 'items-center', 'justify-between')}>
        <p className={cn('text-muted-foreground', 'text-sm')}>{groups.length} grup</p>
        <Button onClick={handleCreate} size="sm">
          <Plus className={cn('mr-2', 'h-4', 'w-4')} />
          Buat Grup
        </Button>
      </div>

      <div className={cn('rounded-md', 'border', 'overflow-x-auto')}>
        <Table className="min-w-150">
          <TableHeader>
            <TableRow>
              <TableHead>Nama Grup</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className={cn('text-muted-foreground', 'py-8', 'text-center')}>
                  Belum ada grup.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className={cn('text-muted-foreground', 'text-sm')}>
                    {group.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {group.leader ? (
                      <div className={cn('flex', 'items-center', 'gap-2')}>
                        <Avatar className={cn('h-6', 'w-6')}>
                          <AvatarImage src={group.leader.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(group.leader.fullName, group.leader.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{group.leader.fullName ?? group.leader.email}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Users className={cn('h-3', 'w-3')} />
                      {group._count.members}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={cn('flex', 'items-center', 'justify-end', 'gap-1')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => handleEdit(group)}
                      >
                        <Pencil className={cn('h-4', 'w-4')} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Hapus"
                        className={cn('text-destructive', 'hover:text-destructive')}
                        onClick={() => setDeleteTarget(group)}
                      >
                        <Trash2 className={cn('h-4', 'w-4')} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GroupDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editGroup={editGroup}
        users={users}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Grup</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus grup{" "}
              <strong>{deleteTarget?.name}</strong>? Semua anggota akan dikeluarkan dari grup ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
