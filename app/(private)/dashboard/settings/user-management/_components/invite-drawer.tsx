"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Earth, User, UsersGroupRounded } from "@solar-icons/react";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { cn } from "@/lib/utils";
import { useInviteUser, useUpdateUser } from "@/hooks/use-users";
import { useGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember } from "@/hooks/use-groups";
import type { UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { ManagerProfile } from "@/lib/queries/users";

interface InviteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RolesQueryResult;
  editUser?: UserQueryItem | null;
}

type DataScope = "own" | "group" | "all";

const initialFormData = {
  email: "",
  fullName: "",
  nickName: "",
  phoneNumber: "",
  placeOfBirth: "",
  dateOfBirth: "",
  ktpAddress: "",
  currentAddress: "",
  motherName: "",
  maritalStatus: "",
  numberOfChildren: "",
  lastEducation: "",
  emergencyContactName: "",
  emergencyContactRel: "",
  emergencyContactPhone: "",
  roleId: "",
  managerId: "",
  dataScope: "own" as DataScope,
};

const inputClass = "mt-1 border-[#CCCCCC] bg-[#F9F9F9]";
const errorInputClass = "border-[#E80606]";

export function InviteDrawer({ open, onOpenChange, roles, editUser }: InviteDrawerProps) {
  const isEdit = !!editUser;
  const { data: session, update: updateSession } = useSession();
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const { data: groupsResult } = useGroups();
  const groups = groupsResult?.data ?? [];
  const { data: managers = [] } = useQuery<ManagerProfile[]>({
    queryKey: ["managers"],
    queryFn: async () => {
      const res = await fetch("/api/managers");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const createGroup = useCreateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const [formData, setFormData] = useState(initialFormData);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const isPending = isEdit ? updateUser.isPending : inviteUser.isPending;

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      if (editUser?.profile) {
        const p = editUser.profile;
        setFormData({
          email: editUser.email,
          fullName: p.fullName ?? "",
          nickName: p.nickName ?? "",
          phoneNumber: p.phoneNumber ?? "",
          placeOfBirth: p.placeOfBirth ?? "",
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().slice(0, 10) : "",
          ktpAddress: p.ktpAddress ?? "",
          currentAddress: p.currentAddress ?? "",
          motherName: p.motherName ?? "",
          maritalStatus: p.maritalStatus ?? "",
          numberOfChildren: p.numberOfChildren?.toString() ?? "",
          lastEducation: p.lastEducation ?? "",
          emergencyContactName: p.emergencyContactName ?? "",
          emergencyContactRel: p.emergencyContactRel ?? "",
          emergencyContactPhone: p.emergencyContactPhone ?? "",
          roleId: p.role?.id ?? "",
          managerId: p.managerId ?? "",
          dataScope: (p.dataScope as DataScope) ?? "own",
        });
        setSelectedGroupIds(p.dataGroupMemberships?.map((m) => m.group.id) ?? []);
      } else {
        setFormData(initialFormData);
        setSelectedGroupIds([]);
      }
      setErrors({});
    });
  }, [open, editUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleInput = (field: keyof typeof formData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    clearError(field);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!isEdit && !formData.email.trim()) next.email = "Email wajib diisi";
    else if (!isEdit && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      next.email = "Format email tidak valid";
    if (!formData.fullName.trim()) next.fullName = "Nama wajib diisi";
    if (!formData.roleId) next.roleId = "Role wajib dipilih";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (isEdit && editUser?.profile) {
      const result = await updateUser.mutateAsync({
        userId: editUser.profile.id,
        fullName: formData.fullName,
        nickName: formData.nickName || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        roleId: formData.roleId,
        managerId: formData.managerId || undefined,
        dataScope: formData.dataScope,
        placeOfBirth: formData.placeOfBirth || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        ktpAddress: formData.ktpAddress || undefined,
        currentAddress: formData.currentAddress || undefined,
        motherName: formData.motherName || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        numberOfChildren: formData.numberOfChildren ? Number(formData.numberOfChildren) : undefined,
        lastEducation: formData.lastEducation || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactRel: formData.emergencyContactRel || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
      });
      if (!result.success) { toast.error(result.error); return; }

      // Sync group memberships
      const existing = editUser.profile.dataGroupMemberships?.map((m) => m.group.id) ?? [];
      const toAdd = selectedGroupIds.filter((id) => !existing.includes(id));
      const toRemove = existing.filter((id) => !selectedGroupIds.includes(id));
      const profileId = editUser.profile.id;
      await Promise.all([
        ...toAdd.map((gid) => addMember.mutateAsync({ groupId: gid, userId: profileId })),
        ...toRemove.map((gid) => removeMember.mutateAsync({ groupId: gid, userId: profileId })),
      ]);

      // If the admin edited their OWN account (e.g. changed their role),
      // refresh the JWT now so the sidebar reflects it without waiting for
      // the 10-min cache TTL or a full re-login.
      if (session?.user?.id === editUser.id) {
        await updateSession();
      }

      toast.success(result.message ?? "User berhasil diperbarui.");
      onOpenChange(false);
    } else {
      const fd = new FormData();
      fd.set("email", formData.email);
      fd.set("fullName", formData.fullName);
      fd.set("roleId", formData.roleId);
      if (formData.managerId) fd.set("managerId", formData.managerId);
      fd.set("dataScope", formData.dataScope);

      const result = await inviteUser.mutateAsync(fd);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(result.message ?? "Undangan berhasil dikirim.");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setSelectedGroupIds([]);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Drawer isOpen={open} onClose={handleClose} title={isEdit ? "Edit User" : "Invite New User"}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto space-y-3 px-2">

          {/* Email — invite only */}
          {!isEdit && (
            <div>
              <Label className="text-sm font-medium text-gray-700">Email *</Label>
              <Input
                type="email"
                placeholder="Enter email address"
                autoComplete="off"
                className={cn(inputClass, errors.email && errorInputClass)}
                value={formData.email}
                onChange={(e) => handleInput("email", e.target.value)}
              />
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
            </div>
          )}

          {/* Full Name */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Full Name *</Label>
            <Input
              placeholder="Enter full name"
              autoComplete="off"
              className={cn(inputClass, errors.fullName && errorInputClass)}
              value={formData.fullName}
              onChange={(e) => handleInput("fullName", e.target.value)}
            />
            {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName}</p>}
          </div>

          {/* Phone Number */}
          <div>
            <Label className="text-sm font-medium text-gray-700">No. HP</Label>
            <div className="mt-1">
              <PhoneInput
                value={formData.phoneNumber}
                onChange={(v) => handleInput("phoneNumber", v)}
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Role *</Label>
            <Select value={formData.roleId} onValueChange={(v) => handleInput("roleId", v)}>
              <SelectTrigger className={cn("mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]", errors.roleId && errorInputClass)}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleId && <p className="mt-1 text-sm text-destructive">{errors.roleId}</p>}
          </div>

          {/* Manager */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Manager</Label>
            <div className="mt-1">
              <SearchableSelect
                options={[
                  { id: "", name: "Tanpa manager" },
                  ...managers.map((m) => ({
                    id: m.id,
                    name: m.fullName ?? "",
                    badge: m.role?.name === "manager-mice" ? "manager mice" : "manager sales",
                  })),
                ]}
                value={formData.managerId}
                onChange={(v) => handleInput("managerId", v ?? "")}
                placeholder="Pilih manager (opsional)"
                searchPlaceholder="Cari manager..."
                emptyText="Tidak ada manager"
              />
            </div>
          </div>

          {/* Data Access */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Data Access</Label>
            <p className="text-xs text-gray-500 mt-1 mb-2">Controls which booking data this user can see</p>
            <div className="flex gap-2">
              {(["own", "group", "all"] as const).map((scope) => {
                const icons = { own: <User weight="BoldDuotone" className="h-3 w-3" />, group: <UsersGroupRounded weight="BoldDuotone" className="h-3 w-3" />, all: <Earth weight="BoldDuotone" className="h-3 w-3" /> };
                const labels = { own: "Own", group: "Group", all: "All" };
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, dataScope: scope }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-all flex-1 justify-center",
                      formData.dataScope === scope
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    )}
                  >
                    {icons[scope]}{labels[scope]}
                  </button>
                );
              })}
            </div>

            {formData.dataScope === "group" && (
              <div className="mt-3 space-y-2">
                {!isEdit && <p className="text-[11px] text-amber-600">Group akan ditetapkan setelah user dibuat.</p>}
                <p className="text-xs text-gray-500">Assign to groups:</p>
                {selectedGroupIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedGroupIds.map((gid) => {
                      const g = groups.find((x) => x.id === gid);
                      if (!g) return null;
                      return (
                        <span key={gid} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                          {g.name}
                          <button type="button" onClick={() => setSelectedGroupIds((p) => p.filter((id) => id !== gid))} className="ml-0.5 hover:text-gray-300">×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <SearchableSelect
                  options={groups.filter((g) => !selectedGroupIds.includes(g.id)).map((g) => ({ id: g.id, name: g.name }))}
                  value={undefined}
                  onChange={(gid) => { if (gid && !selectedGroupIds.includes(gid)) setSelectedGroupIds((p) => [...p, gid]); }}
                  placeholder="Tambah ke group..."
                  searchPlaceholder="Cari atau buat group..."
                  emptyText="Tidak ada group"
                  onAdd={async (name) => {
                    const result = await createGroup.mutateAsync({ name });
                    if (result.success && result.group) setSelectedGroupIds((p) => [...p, result.group!.id]);
                    else toast.error(result.error ?? "Gagal membuat group");
                  }}
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-background sticky bottom-0 z-10">
          <div className="flex py-4 gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 text-destructive border-destructive hover:bg-destructive/10" disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1" disabled={isPending}>
              {isPending ? "Processing..." : isEdit ? "Update User" : "Send Invitation"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
