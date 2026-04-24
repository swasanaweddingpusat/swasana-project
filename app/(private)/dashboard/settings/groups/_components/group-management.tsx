"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Drawer } from "@/components/shared/drawer";
import {
  Pencil, Trash2, Plus, Users2, ChevronDown, ChevronUp,
  Crown, GripVertical,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createGroup, updateGroup, deleteGroup,
  addGroupMember, removeGroupMember,
  reorderGroups, reorderGroupMembers,
} from "@/actions/group";
import type { GroupsQueryResult, GroupQueryItem } from "@/lib/queries/groups";
import type { UsersQueryResult } from "@/lib/queries/users";

interface GroupManagementProps {
  initialGroups: GroupsQueryResult;
  users: UsersQueryResult;
}

export function GroupManagement({ initialGroups, users }: GroupManagementProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupQueryItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupQueryItem | null>(null);

  const allProfiles = users.users
    .filter((u) => u.profile)
    .map((u) => ({ id: u.profile!.id, name: u.profile!.fullName ?? u.email, role: u.profile!.role?.name }));

  function openCreate() {
    setEditingGroup(null);
    setFormName("");
    setFormDesc("");
    setDrawerOpen(true);
  }

  function openEdit(group: GroupQueryItem) {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDesc(group.description ?? "");
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    if (editingGroup) {
      const result = await updateGroup({ id: editingGroup.id, name: formName.trim(), description: formDesc.trim() || undefined });
      if (result.success) {
        setGroups((prev) => prev.map((g) => g.id === editingGroup.id ? { ...g, name: formName.trim(), description: formDesc.trim() || null } : g));
        toast.success("Grup diperbarui.");
      } else {
        toast.error(result.error ?? "Gagal memperbarui grup.");
      }
    } else {
      const result = await createGroup({ name: formName.trim(), description: formDesc.trim() || undefined });
      if (result.success && result.group) {
        setGroups((prev) => [...prev, { ...result.group, leader: null, members: [], _count: { members: 0 } } as unknown as GroupQueryItem]);
        toast.success("Grup dibuat.");
      } else {
        toast.error(result.error ?? "Gagal membuat grup.");
      }
    }
    setSaving(false);
    setDrawerOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const group = deleteTarget;
    setGroups((prev) => prev.filter((g) => g.id !== group.id));
    const result = await deleteGroup(group.id);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menghapus grup.");
      setGroups((prev) => [...prev, group]);
    } else {
      toast.success("Grup dihapus.");
    }
    setDeleteTarget(null);
  }

  async function handleAddMember(groupId: string, userId: string) {
    const profile = allProfiles.find((p) => p.id === userId);
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      const newMember = { userId, sortOrder: g.members.length, profile: { id: userId, fullName: profile?.name ?? null, email: profile?.name ?? "", avatarUrl: null, role: profile?.role ? { id: "", name: profile.role } : null } };
      return { ...g, members: [...g.members, newMember as typeof g.members[number]], _count: { members: g._count.members + 1 } };
    }));
    const result = await addGroupMember(groupId, userId);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menambahkan anggota.");
      setGroups((prev) => prev.map((g) => g.id !== groupId ? g : { ...g, members: g.members.filter((m) => m.userId !== userId), _count: { members: g._count.members - 1 } }));
    }
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, leaderId: g.leaderId === userId ? null : g.leaderId, leader: g.leaderId === userId ? null : g.leader, members: g.members.filter((m) => m.userId !== userId), _count: { members: g._count.members - 1 } };
    }));
    const result = await removeGroupMember(groupId, userId);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menghapus anggota.");
      setGroups((prev) => prev.map((g) => g.id !== groupId ? g : group));
    }
  }

  async function handleSetLeader(groupId: string, userId: string | null) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const member = group.members.find((m) => m.userId === userId);
    setGroups((prev) => prev.map((g) => g.id !== groupId ? g : { ...g, leaderId: userId, leader: userId && member ? { id: member.profile.id, fullName: member.profile.fullName, email: member.profile.email, avatarUrl: member.profile.avatarUrl } : null }));
    const result = await updateGroup({ id: groupId, leaderId: userId });
    if (!result.success) {
      toast.error(result.error ?? "Gagal mengubah leader.");
      setGroups((prev) => prev.map((g) => g.id !== groupId ? g : group));
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.index === destination.index && source.droppableId === destination.droppableId) return;

    if (type === "GROUP") {
      const reordered = Array.from(groups);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      setGroups(reordered);
      await reorderGroups(reordered.map((g) => g.id));
    } else if (type === "MEMBER") {
      const groupId = source.droppableId.replace("members-", "");
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const reorderedMembers = Array.from(group.members);
      const [moved] = reorderedMembers.splice(source.index, 1);
      reorderedMembers.splice(destination.index, 0, moved);
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: reorderedMembers } : g));
      await reorderGroupMembers(groupId, reorderedMembers.map((m) => m.userId));
    }
  }

  return (
    <div className="px-6 pb-4 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-bold text-[#1D1D1D]">Group Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola grup data untuk scope akses user</p>
        </div>
        <Button onClick={openCreate} className="bg-gray-900 text-white hover:bg-gray-800 cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Buat Grup
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Belum ada grup. Buat grup untuk memulai.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="groups" type="GROUP">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {groups.map((group, groupIndex) => {
                  const isExpanded = expandedGroupId === group.id;
                  const memberIds = group.members.map((m) => m.userId);
                  const nonMembers = allProfiles.filter((p) => !memberIds.includes(p.id));
                  const leaderName = group.leader?.fullName ?? null;

                  return (
                    <Draggable key={group.id} draggableId={group.id} index={groupIndex}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`border border-gray-200 rounded-lg bg-white overflow-hidden transition-shadow ${dragSnapshot.isDragging ? "shadow-lg" : ""}`}
                        >
                          {/* Group header */}
                          <div className="flex items-center justify-between px-4 py-3">
                            <div {...dragProvided.dragHandleProps} className="mr-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <button
                              type="button"
                              className="flex items-center gap-3 flex-1 text-left cursor-pointer"
                              onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                            >
                              <div className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                                {group._count.members}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{group.name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {group.description && <span className="text-xs text-gray-500">{group.description}</span>}
                                  {leaderName && (
                                    <span className="flex items-center gap-1 text-xs text-amber-600">
                                      <Crown className="h-3 w-3" /> {leaderName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                            </button>
                            <div className="flex items-center gap-1 ml-3">
                              <button type="button" onClick={() => openEdit(group)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 cursor-pointer">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(group)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Members section */}
                          {isExpanded && (
                            <div className="border-t border-gray-100">
                              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                <SearchableSelect
                                  options={nonMembers.map((p) => ({ id: p.id, name: p.name, badge: p.role }))}
                                  value={undefined}
                                  onChange={(uid) => { if (uid) handleAddMember(group.id, uid); }}
                                  placeholder="Tambah member..."
                                  searchPlaceholder="Cari user..."
                                  emptyText="Tidak ada user tersedia"
                                />
                              </div>

                              {group.members.length > 0 ? (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                      <th className="w-8 px-3 py-2.5"></th>
                                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Keanggotaan</th>
                                      <th className="px-4 py-2.5 w-16"></th>
                                    </tr>
                                  </thead>
                                  <Droppable droppableId={`members-${group.id}`} type="MEMBER">
                                    {(memberProvided) => (
                                      <tbody ref={memberProvided.innerRef} {...memberProvided.droppableProps} className="divide-y divide-gray-50">
                                        {group.members.map((member, memberIndex) => {
                                          const isLeader = member.userId === group.leaderId;
                                          return (
                                            <Draggable key={member.userId} draggableId={`${group.id}-${member.userId}`} index={memberIndex}>
                                              {(memberDrag, memberSnapshot) => (
                                                <tr
                                                  ref={memberDrag.innerRef}
                                                  {...memberDrag.draggableProps}
                                                  className={`hover:bg-gray-50 transition-colors ${memberSnapshot.isDragging ? "bg-blue-50 shadow-sm" : ""}`}
                                                >
                                                  <td className="px-3 py-2.5">
                                                    <div {...memberDrag.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
                                                      <GripVertical className="h-3.5 w-3.5" />
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                      {isLeader && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                                      <span className="font-medium text-gray-900">{member.profile.fullName ?? member.profile.email}</span>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-2.5 text-gray-500 capitalize">{member.profile.role?.name ?? "—"}</td>
                                                  <td className="px-4 py-2.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSetLeader(group.id, isLeader ? null : member.userId)}
                                                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                                                        isLeader
                                                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                                          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                                                      }`}
                                                    >
                                                      {isLeader ? "Leader" : "Anggota"}
                                                    </button>
                                                  </td>
                                                  <td className="px-4 py-2.5 text-right">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveMember(group.id, member.userId)}
                                                      className="text-xs text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                                                    >
                                                      Hapus
                                                    </button>
                                                  </td>
                                                </tr>
                                              )}
                                            </Draggable>
                                          );
                                        })}
                                        {memberProvided.placeholder}
                                      </tbody>
                                    )}
                                  </Droppable>
                                </table>
                              ) : (
                                <p className="text-xs text-gray-400 px-4 py-3">Belum ada anggota</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Create/Edit Drawer */}
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editingGroup ? "Edit Grup" : "Buat Grup"}>
        <div className="flex flex-col justify-between h-full">
          <div className="space-y-4 px-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Nama Grup *</Label>
              <Input className="mt-1" placeholder="Contoh: Sales Thamrin" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Deskripsi</Label>
              <Input className="mt-1" placeholder="Deskripsi opsional" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white z-10">
            <div className="flex py-4 gap-2">
              <Button variant="outline" onClick={() => setDrawerOpen(false)} className="flex-1 cursor-pointer text-red-600 border-red-600 hover:bg-red-50" disabled={saving}>
                Batal
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer" disabled={saving || !formName.trim()}>
                {saving ? "Menyimpan..." : editingGroup ? "Simpan" : "Buat"}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Grup</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus grup <strong>{deleteTarget?.name}</strong>? Semua anggota akan dikeluarkan. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
