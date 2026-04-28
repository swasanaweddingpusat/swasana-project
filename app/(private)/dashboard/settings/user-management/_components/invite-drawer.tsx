"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Building2, Globe, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInviteUser, useUpdateUser } from "@/hooks/use-users";
import {
  useGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember,
} from "@/hooks/use-groups";
import type { UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { BrandsQueryResult } from "@/lib/queries/venues";
import type { ManagerProfile } from "@/lib/queries/users";

interface InviteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RolesQueryResult;
  brands: BrandsQueryResult;
  editUser?: UserQueryItem | null;
}

type VenueScope = "individual" | "general";
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
  venueIds: [] as string[],
  venueScopes: {} as Record<string, VenueScope>,
  venueManagers: {} as Record<string, string>,
  dataScope: "own" as DataScope,
};

const inputClass =
  "mt-1 border-[#CCCCCC] bg-[#F9F9F9] focus:border-[#CCCCCC] focus:ring-[#CCCCCC]";
const errorInputClass =
  "border-[#E80606] focus:border-[#E80606] focus:ring-[#E80606]";

export function InviteDrawer({
  open, onOpenChange, roles, brands, editUser,
}: InviteDrawerProps) {
  const isEdit = !!editUser;
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const { data: groups = [] } = useGroups();
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
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isEdit ? updateUser.isPending : inviteUser.isPending;

  // Populate when opening
  const editId = editUser?.id;
  useEffect(() => {
    if (!open) return;
    if (editUser?.profile) {
      const p = editUser.profile;
      const venueIds = p.userVenueAccess?.map((v) => v.venue.id) ?? [];
      const venueScopes: Record<string, VenueScope> = {};
      const venueManagers: Record<string, string> = {};
      p.userVenueAccess?.forEach((v) => {
        venueScopes[v.venue.id] = (v.scope as VenueScope) ?? "individual";
        if (v.managerId) venueManagers[v.venue.id] = v.managerId;
      });

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        email: editUser.email,
        fullName: p.fullName ?? "",
        nickName: p.nickName ?? "",
        phoneNumber: p.phoneNumber ?? "",
        placeOfBirth: p.placeOfBirth ?? "",
        dateOfBirth: p.dateOfBirth
          ? new Date(p.dateOfBirth).toISOString().slice(0, 10)
          : "",
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
        venueIds,
        venueScopes,
        venueManagers,
        dataScope: (p.dataScope as DataScope) ?? "own",
      });

      // Expand brands that own selected venues
      const brandIds = brands
        .filter((b) => b.venues.some((v) => venueIds.includes(v.id)))
        .map((b) => b.id);
      setSelectedBrands(brandIds);

      // Current group memberships
      const groupIds =
        p.dataGroupMemberships?.map((m) => m.group.id) ?? [];
      setSelectedGroupIds(groupIds);
    } else {
      setFormData(initialFormData);
      setSelectedBrands([]);
      setSelectedGroupIds([]);
    }
    setErrors({});
  }, [open, editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleInput = (field: keyof typeof formData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    clearError(field);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!isEdit && !formData.email.trim()) next.email = "Email wajib diisi";
    else if (
      !isEdit &&
      formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    )
      next.email = "Format email tidak valid";
    if (!formData.fullName.trim()) next.fullName = "Nama wajib diisi";
    if (!formData.roleId) next.roleId = "Role wajib dipilih";
    if (formData.venueIds.length === 0)
      next.venueIds = "Minimal satu venue harus dipilih";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ─── Venue + brand helpers ────────────────────────────────────────────────

  const allVenueIds = useMemo(
    () => brands.flatMap((b) => b.venues.map((v) => v.id)),
    [brands]
  );
  const allVenuesCount = allVenueIds.length;
  const allVenuesSelected =
    allVenuesCount > 0 && formData.venueIds.length >= allVenuesCount;

  const toggleVenue = (venueId: string, checked: boolean) => {
    setFormData((prev) => {
      const newVenues = checked
        ? [...prev.venueIds, venueId]
        : prev.venueIds.filter((id) => id !== venueId);
      const newScopes = { ...prev.venueScopes };
      const newManagers = { ...prev.venueManagers };
      if (checked) newScopes[venueId] = newScopes[venueId] ?? "individual";
      else { delete newScopes[venueId]; delete newManagers[venueId]; }
      return { ...prev, venueIds: newVenues, venueScopes: newScopes, venueManagers: newManagers };
    });
    clearError("venueIds");
  };

  const selectAllForBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return;
    const venueIds = brand.venues.map((v) => v.id);
    const allSelected = venueIds.every((id) => formData.venueIds.includes(id));

    setFormData((prev) => {
      if (allSelected) {
        const newVenues = prev.venueIds.filter((id) => !venueIds.includes(id));
        const newScopes = { ...prev.venueScopes };
        const newManagers = { ...prev.venueManagers };
        venueIds.forEach((id) => { delete newScopes[id]; delete newManagers[id]; });
        return { ...prev, venueIds: newVenues, venueScopes: newScopes, venueManagers: newManagers };
      } else {
        const newVenues = [...new Set([...prev.venueIds, ...venueIds])];
        const newScopes = { ...prev.venueScopes };
        venueIds.forEach((id) => { if (!newScopes[id]) newScopes[id] = "individual"; });
        return { ...prev, venueIds: newVenues, venueScopes: newScopes };
      }
    });
    clearError("venueIds");
  };

  const toggleAllVenues = (checked: boolean) => {
    const allBrandIds = brands.map((b) => b.id);
    if (checked) {
      setSelectedBrands(allBrandIds);
      setFormData((prev) => {
        const newScopes = { ...prev.venueScopes };
        allVenueIds.forEach((id) => { if (!newScopes[id]) newScopes[id] = "individual"; });
        return { ...prev, venueIds: [...allVenueIds], venueScopes: newScopes };
      });
    } else {
      setFormData((prev) => ({ ...prev, venueIds: [], venueScopes: {}, venueManagers: {} }));
    }
    clearError("venueIds");
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    if (isEdit && editUser?.profile) {
      const payload: Record<string, unknown> = {
        userId: editUser.profile.id,
        fullName: formData.fullName,
        nickName: formData.nickName || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        roleId: formData.roleId,
        venueIds: formData.venueIds,
        venueScopes: formData.venueScopes,
        venueManagers: formData.venueManagers,
        dataScope: formData.dataScope,
        placeOfBirth: formData.placeOfBirth || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        ktpAddress: formData.ktpAddress || undefined,
        currentAddress: formData.currentAddress || undefined,
        motherName: formData.motherName || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        numberOfChildren: formData.numberOfChildren
          ? Number(formData.numberOfChildren)
          : undefined,
        lastEducation: formData.lastEducation || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactRel: formData.emergencyContactRel || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
      };

      const result = await updateUser.mutateAsync(payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Sync group memberships
      const existing =
        editUser.profile.dataGroupMemberships?.map((m) => m.group.id) ?? [];
      const toAdd = selectedGroupIds.filter((id) => !existing.includes(id));
      const toRemove = existing.filter((id) => !selectedGroupIds.includes(id));
      const profileId = editUser.profile.id;

      await Promise.all([
        ...toAdd.map((gid) =>
          addMember.mutateAsync({ groupId: gid, userId: profileId })
        ),
        ...toRemove.map((gid) =>
          removeMember.mutateAsync({ groupId: gid, userId: profileId })
        ),
      ]);

      toast.success(result.message ?? "User berhasil diperbarui.");
      onOpenChange(false);
    } else {
      const fd = new FormData();
      fd.set("email", formData.email);
      fd.set("fullName", formData.fullName);
      fd.set("roleId", formData.roleId);
      fd.set("venueIds", JSON.stringify(formData.venueIds));
      fd.set("venueScopes", JSON.stringify(formData.venueScopes));
      fd.set("venueManagers", JSON.stringify(formData.venueManagers));
      fd.set("dataScope", formData.dataScope);

      const result = await inviteUser.mutateAsync(fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Undangan berhasil dikirim.");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setSelectedBrands([]);
    setSelectedGroupIds([]);
    setErrors({});
    onOpenChange(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title={isEdit ? "Edit User" : "Invite New User"}
    >
      <div className={cn('flex', 'flex-col', 'justify-between', 'h-full')}>
        <div className={cn('flex-1', 'overflow-y-auto', 'scrollbar-hide')}>
          <div className={cn('space-y-3', 'px-2')}>
            {/* Email — invite only */}
            {!isEdit && (
              <div>
                <Label htmlFor="email" className={cn('text-sm', 'font-medium', 'text-gray-700')}>
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  autoComplete="off"
                  className={cn(inputClass, errors.email && errorInputClass, isEdit && "opacity-60 cursor-not-allowed")}
                  value={formData.email}
                  onChange={(e) => !isEdit && handleInput("email", e.target.value)}
                  disabled={isEdit}
                />
                {errors.email && (
                  <p className={cn('mt-1', 'text-sm', 'text-[#E80606]')}>{errors.email}</p>
                )}
              </div>
            )}

            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className={cn('text-sm', 'font-medium', 'text-gray-700')}>
                Full Name *
              </Label>
              <Input
                id="fullName"
                placeholder="Enter full name"
                autoComplete="off"
                className={cn(inputClass, errors.fullName && errorInputClass)}
                value={formData.fullName}
                onChange={(e) => handleInput("fullName", e.target.value)}
              />
              {errors.fullName && (
                <p className={cn('mt-1', 'text-sm', 'text-[#E80606]')}>{errors.fullName}</p>
              )}
            </div>

            {/* Role */}
            <div className="w-full">
              <Label htmlFor="roleId" className={cn('text-sm', 'font-medium', 'text-gray-700')}>
                Role *
              </Label>
              <Select
                value={formData.roleId}
                onValueChange={(v) => handleInput("roleId", v)}
              >
                <SelectTrigger
                  className={cn(
                    "mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]",
                    errors.roleId && errorInputClass
                  )}
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <span className="capitalize">{role.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className={cn('mt-1', 'text-sm', 'text-[#E80606]')}>{errors.roleId}</p>
              )}
            </div>

            {/* Data Access */}
            <div>
              <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Data Access</Label>
              <p className={cn('text-xs', 'text-gray-500', 'mt-1', 'mb-2')}>
                Controls which booking data this user can see
              </p>
              <div className={cn('flex', 'gap-2')}>
                {(["own", "group", "all"] as const).map((scope) => {
                  const icons = {
                    own: <User className={cn('h-3', 'w-3')} />,
                    group: <Users className={cn('h-3', 'w-3')} />,
                    all: <Globe className={cn('h-3', 'w-3')} />,
                  };
                  const labels = { own: "Own", group: "Group", all: "All" };
                  const descs = {
                    own: "Only their own bookings",
                    group: "Bookings from group members",
                    all: "All bookings",
                  };
                  const isActive = formData.dataScope === scope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({ ...p, dataScope: scope }))
                      }
                      title={descs[scope]}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-all flex-1 justify-center",
                        isActive
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      {icons[scope]}
                      {labels[scope]}
                    </button>
                  );
                })}
              </div>

              {formData.dataScope === "group" && (
                <div className={cn('mt-3', 'space-y-2')}>
                  {!isEdit && (
                    <p className={cn('text-[11px]', 'text-amber-600')}>
                      Group akan ditetapkan setelah user dibuat.
                    </p>
                  )}
                  <p className={cn('text-xs', 'text-gray-500')}>Assign to groups:</p>
                  {selectedGroupIds.length > 0 && (
                    <div className={cn('flex', 'flex-wrap', 'gap-1.5', 'mb-2')}>
                      {selectedGroupIds.map((gid) => {
                        const g = groups.find((x) => x.id === gid);
                        if (!g) return null;
                        return (
                          <span
                            key={gid}
                            className={cn('flex', 'items-center', 'gap-1', 'px-2', 'py-0.5', 'text-xs', 'bg-gray-900', 'text-white', 'rounded-full')}
                          >
                            {g.name}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedGroupIds((prev) =>
                                  prev.filter((id) => id !== gid)
                                )
                              }
                              className={cn('ml-0.5', 'hover:text-gray-300')}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <SearchableSelect
                    options={groups
                      .filter((g) => !selectedGroupIds.includes(g.id))
                      .map((g) => ({ id: g.id, name: g.name }))}
                    value={undefined}
                    onChange={(gid) => {
                      if (gid && !selectedGroupIds.includes(gid)) {
                        setSelectedGroupIds((prev) => [...prev, gid]);
                      }
                    }}
                    placeholder="Tambah ke group..."
                    searchPlaceholder="Cari atau buat group..."
                    emptyText="Tidak ada group"
                    onAdd={async (name) => {
                      const result = await createGroup.mutateAsync({ name });
                      if (result.success && result.group) {
                        setSelectedGroupIds((prev) => [...prev, result.group!.id]);
                      } else {
                        toast.error(result.error ?? "Gagal membuat group");
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Assigned Venues */}
            <div>
              <div className={cn('flex', 'items-center', 'justify-between')}>
                <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>
                  Assigned Venues
                </Label>
                {allVenuesCount > 0 && (
                  <div className={cn('flex', 'items-center', 'gap-2')}>
                    <span className={cn('text-[11px]', 'text-gray-400')}>All</span>
                    <Switch
                      checked={allVenuesSelected}
                      onCheckedChange={toggleAllVenues}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>
              <p className={cn('text-xs', 'text-gray-500', 'mt-1', 'mb-2')}>
                Select brands and venues that this user will have access to
              </p>
              {errors.venueIds && (
                <p className={cn('mb-2', 'text-sm', 'text-[#E80606]')}>{errors.venueIds}</p>
              )}

              <div className="space-y-2">
                {brands.map((brand) => {
                  const isExpanded = selectedBrands.includes(brand.id);
                  const brandVenues = brand.venues ?? [];
                  const selectedCount = brandVenues.filter((v) =>
                    formData.venueIds.includes(v.id)
                  ).length;
                  const allSelectedForBrand =
                    brandVenues.length > 0 &&
                    selectedCount === brandVenues.length;

                  return (
                    <div
                      key={brand.id}
                      className={cn(
                        "rounded-lg border transition-all duration-200",
                        isExpanded
                          ? "border-gray-300 bg-white shadow-sm"
                          : "border-gray-200 bg-gray-50/50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBrands((prev) =>
                            prev.includes(brand.id)
                              ? prev.filter((id) => id !== brand.id)
                              : [...prev, brand.id]
                          )
                        }
                        className={cn('flex', 'items-center', 'w-full', 'px-3', 'py-2.5', 'gap-2.5')}
                      >
                        <Building2
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isExpanded ? "text-gray-900" : "text-gray-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm flex-1 text-left transition-colors",
                            isExpanded
                              ? "font-semibold text-gray-900"
                              : "font-medium text-gray-600"
                          )}
                        >
                          {brand.name}
                        </span>
                        {selectedCount > 0 && (
                          <span className={cn('text-[10px]', 'font-medium', 'bg-black', 'text-white', 'rounded-full', 'px-1.5', 'py-0.5', 'min-w-5', 'text-center')}>
                            {selectedCount}
                          </span>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </button>

                      {isExpanded && (
                        <div className={cn('px-3', 'pb-3')}>
                          {brandVenues.length > 0 && (
                            <div className={cn('flex', 'items-center', 'justify-between', 'mb-2', 'pb-2', 'border-b', 'border-gray-100')}>
                              <span className={cn('text-[11px]', 'text-gray-400', 'uppercase', 'tracking-wider')}>
                                {brandVenues.length} venue
                                {brandVenues.length > 1 ? "s" : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => selectAllForBrand(brand.id)}
                                className={cn('text-[11px]', 'font-medium', 'text-gray-500', 'hover:text-gray-900', 'transition-colors')}
                              >
                                {allSelectedForBrand
                                  ? "Deselect all"
                                  : "Select all"}
                              </button>
                            </div>
                          )}

                          {brandVenues.length === 0 ? (
                            <p className={cn('text-xs', 'text-gray-400', 'py-2', 'text-center')}>
                              No venues available
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {brandVenues.map((venue) => {
                                const isSelected = formData.venueIds.includes(
                                  venue.id
                                );
                                return (
                                  <div key={venue.id} className="space-y-1.5">
                                    <div
                                      className={cn(
                                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-all duration-150 cursor-pointer",
                                        isSelected
                                          ? "bg-gray-900 text-white"
                                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                                      )}
                                      onClick={() =>
                                        toggleVenue(venue.id, !isSelected)
                                      }
                                    >
                                      <Checkbox
                                        id={venue.id}
                                        checked={isSelected}
                                        onCheckedChange={(checked) =>
                                          toggleVenue(venue.id, checked as boolean)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                          "shrink-0 border-gray-300",
                                          isSelected &&
                                            "border-white data-[state=checked]:bg-white data-[state=checked]:text-gray-900"
                                        )}
                                      />
                                      <span className={cn('text-xs', 'font-medium', 'flex-1', 'truncate')}>
                                        {venue.name}
                                      </span>
                                    </div>
                                    {isSelected && managers.length > 0 && (
                                      <div className={cn('pl-7', 'pr-1')}>
                                        <SearchableSelect
                                          options={[{ id: "", name: "Tanpa manager" }, ...managers.map((m) => ({ id: m.id, name: m.fullName ?? "" }))]}
                                          value={formData.venueManagers[venue.id] ?? ""}
                                          onChange={(v) =>
                                            setFormData((prev) => ({
                                              ...prev,
                                              venueManagers: v
                                                ? { ...prev.venueManagers, [venue.id]: v }
                                                : (() => { const n = { ...prev.venueManagers }; delete n[venue.id]; return n; })(),
                                            }))
                                          }
                                          placeholder="Pilih manager (opsional)"
                                          searchPlaceholder="Cari manager..."
                                          emptyText="Tidak ada manager"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn('bg-white', 'sticky', 'bottom-0', 'z-10')}>
          <div className={cn('flex', 'py-4', 'gap-2')}>
            <Button
              variant="outline"
              onClick={handleClose}
              className={cn('flex-1', 'cursor-pointer', 'text-[#E80606]', 'border-[#E80606]', 'hover:bg-[#FFD6D6]')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className={cn('flex-1', 'bg-black', 'text-white', 'hover:bg-gray-800', 'cursor-pointer')}
              disabled={isPending}
            >
              {isPending
                ? "Processing..."
                : isEdit
                ? "Update User"
                : "Send Invitation"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
