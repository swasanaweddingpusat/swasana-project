"use client";

import { useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InviteDrawer } from "./invite-drawer";
import { BulkEditModal } from "./BulkEditModal";
import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { useQueryClient } from "@tanstack/react-query";
import { resendInvitation } from "@/actions/user";
import type { UsersQueryResult, UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { BrandsQueryResult } from "@/lib/queries/venues";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Trash2, PenLine, Mail, MoreHorizontal, ArrowLeft, ArrowRight,
  X, UserPlus, SlidersHorizontal, RefreshCw,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRoleBadgeClass = () => "bg-secondary text-secondary-foreground";

const getStatusBadgeClass = (verified: boolean) =>
  verified ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsersTableProps {
  initialData: UsersQueryResult;
  roles: RolesQueryResult;
  brands: BrandsQueryResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UsersTable({ initialData, roles, brands }: UsersTableProps) {
  const { data, refetch, isRefetching } = useUsers(initialData);
  const qc = useQueryClient();
  const users: UserQueryItem[] = useMemo(() => data?.users ?? [], [data]);
  const deleteUserMutation = useDeleteUser();

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserQueryItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserQueryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Filters — reset page on change
  const [roleFilter, setRoleFilterRaw] = useState("");
  const [statusFilter, setStatusFilterRaw] = useState("");
  const [venueFilter, setVenueFilterRaw] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const setRoleFilter = (v: string) => { setRoleFilterRaw(v); setCurrentPage(1); };
  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setCurrentPage(1); };
  const setVenueFilter = (v: string) => { setVenueFilterRaw(v); setCurrentPage(1); };

  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const rowsPerPage = 10;

  // Selection is cleared in delete handlers

  // Unique venues for filter
  const allVenues = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => u.profile?.userVenueAccess?.forEach(v => {
      if (!map.has(v.venue.id)) map.set(v.venue.id, v.venue.name);
    }));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Filter
  const filteredUsers = users.filter(user => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = user.profile?.fullName?.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.profile?.role?.name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (roleFilter && user.profile?.role?.id !== roleFilter) return false;
    if (statusFilter === "verified" && !user.profile?.isEmailVerified) return false;
    if (statusFilter === "pending" && user.profile?.isEmailVerified) return false;
    if (venueFilter && !user.profile?.userVenueAccess?.some(v => v.venue.id === venueFilter)) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const hasFilters = !!(roleFilter || statusFilter || venueFilter);

  const clearFilters = () => { setRoleFilter(""); setStatusFilter(""); setVenueFilter(""); };

  // Checkbox
  const isAllSelected = paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUsers.has(u.id));

  const handleSelectAll = (checked: boolean) => {
    setSelectedUsers(checked ? new Set(paginatedUsers.map(u => u.id)) : new Set());
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const next = new Set(selectedUsers);
    if (checked) {
      next.add(userId);
    } else {
      next.delete(userId);
    }
    setSelectedUsers(next);
  };

  // Actions
  const handleEdit = (user: UserQueryItem) => { setEditUser(user); setDrawerOpen(true); };
  const handleAddNew = () => { setEditUser(null); setDrawerOpen(true); };

  const handleResend = async (user: UserQueryItem) => {
    if (!user.profile) return;
    setResendingId(user.profile.id);
    const result = await resendInvitation(user.profile.id);
    setResendingId(null);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete?.profile) return;
    setIsDeleting(true);
    const result = await deleteUserMutation.mutateAsync(userToDelete.profile.id);
    setIsDeleting(false);
    if (result.success) { toast.success("User berhasil dihapus"); }
    else { toast.error(result.error); }
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedUsers);
    const profileIds = ids.map(id => users.find(u => u.id === id)?.profile?.id).filter(Boolean) as string[];
    const results = await Promise.allSettled(profileIds.map(id => deleteUserMutation.mutateAsync(id)));
    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    if (succeeded > 0) toast.success(`${succeeded} user berhasil dihapus`);
    if (failed > 0) toast.error(`${failed} user gagal dihapus`);
    setSelectedUsers(new Set());
    setBulkDeleteOpen(false);
    setIsBulkDeleting(false);
  };

  // Skeleton is handled by loading.tsx — no need for isMounted check

  return (
    <div>
      <Card className="p-0 shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-6 py-4 space-y-3">
            {/* Top row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">List Users</span>
                <span className="text-[11px] font-medium bg-secondary text-secondary-foreground px-2.5 py-0.5 border border-border rounded-full">
                  {filteredUsers.length} Users available
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedUsers.size > 1 && (
                  <>
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-8 text-xs" onClick={() => setBulkEditOpen(true)}>
                      <PenLine className="w-3.5 h-3.5" /> Edit ({selectedUsers.size})
                    </Button>
                    <Button variant="destructive" size="sm" className="flex items-center gap-1.5 h-8 text-xs" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedUsers.size})
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={handleAddNew} className="flex items-center gap-1.5 text-xs h-8">
                  <UserPlus className="w-3.5 h-3.5" /> Invite User
                </Button>
              </div>
            </div>

            {/* Bottom row: Search + Filters */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Cari nama, email..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="h-8 text-xs border-border bg-secondary flex-1 lg:flex-none lg:w-64"
              />

              {/* Desktop filters */}
              <div className="hidden lg:flex items-center gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs border-border bg-secondary"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs border-border bg-secondary"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={venueFilter} onValueChange={setVenueFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs border-border bg-secondary"><SelectValue placeholder="Venue" /></SelectTrigger>
                  <SelectContent>
                    {allVenues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="h-8 px-2 border-border bg-secondary hover:bg-accent"
                  title="Refresh data"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefetching && "animate-spin")} />
                </Button>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Mobile filter */}
              <div className="lg:hidden">
                <Button variant="outline" size="sm" className={cn("h-8 w-8 p-0 border-gray-200", hasFilters && "border-[#1D1D1D] bg-[#1D1D1D] text-white hover:bg-[#333] hover:text-white")}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="relative overflow-x-auto w-full">
            {filteredUsers.length === 0 ? (
              <div className="flex justify-center items-center py-8">
                <div className="text-xs text-gray-500">No users found</div>
              </div>
            ) : (
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-b-2 border-border bg-secondary">
                    <TableHead className="px-4 py-2.5 font-semibold text-muted-foreground text-xs">
                      <Checkbox ref={headerCheckboxRef} checked={isAllSelected} onCheckedChange={handleSelectAll} className="cursor-pointer" />
                    </TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs w-10">No</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Nama</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Email</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Role</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Assigned Venues</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Created Date</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user, index) => {
                    const roleName = user.profile?.role?.name ?? "";
                    const isVerified = user.profile?.isEmailVerified ?? false;
                    const venues = user.profile?.userVenueAccess ?? [];
                    const rowNumber = (currentPage - 1) * rowsPerPage + index + 1;
                    const createdDate = user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                      : "—";
                    return (
                      <TableRow key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="px-4 py-2.5">
                          <Checkbox checked={selectedUsers.has(user.id)} onCheckedChange={(c) => handleSelectUser(user.id, c as boolean)} className="cursor-pointer" />
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-xs text-muted-foreground">{rowNumber}</TableCell>
                        <TableCell className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <ProfileAvatar name={user.profile?.fullName ?? user.email} src={user.profile?.avatarUrl ?? undefined} size="sm" />
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-xs">{user.profile?.fullName ?? user.name ?? "—"}</span>
                              {(user.profile?.dataGroupMemberships?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {user.profile!.dataGroupMemberships!.map((m) => (
                                    <span key={m.group.id} className="px-1.5 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded-full border">{m.group.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-xs text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="px-2 py-2.5">
                          {roleName ? (
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", getRoleBadgeClass())}>
                              {roleName.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="px-2 py-2.5">
                          {venues.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground truncate max-w-32">
                                {venues[0].venue.name}
                              </span>
                              {venues.length > 1 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                  +{venues.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-xs text-muted-foreground">{createdDate}</TableCell>
                        <TableCell className="px-2 py-2.5">
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", getStatusBadgeClass(isVerified))}>
                            {isVerified ? "Verified" : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="p-1 hover:bg-gray-100 rounded cursor-pointer outline-none" title="Actions">
                                <MoreHorizontal className="h-3.5 w-3.5 text-gray-700" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <PenLine className="h-3.5 w-3.5 mr-2" /> Edit
                                </DropdownMenuItem>
                                {!isVerified && (
                                  <DropdownMenuItem onClick={() => handleResend(user)} disabled={resendingId === user.profile?.id}>
                                    <Mail className="h-3.5 w-3.5 mr-2" /> {resendingId === user.profile?.id ? "Sending..." : "Resend Invitation"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { setUserToDelete(user); setDeleteConfirmOpen(true); }} className="text-red-600">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="flex justify-between items-center px-6 py-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                  else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    typeof page === "string" ? (
                      <span key={`e-${idx}`} className="px-2 py-1 text-xs text-gray-400">...</span>
                    ) : (
                      <button key={page} className={cn("px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer", currentPage === page ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary")} onClick={() => setCurrentPage(page)}>
                        {page}
                      </button>
                    )
                  );
                })()}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="text-xs h-8">
                Next <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <DeleteDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} isDeleting={isDeleting} onConfirm={handleConfirmDelete} title="Are you sure you want to delete this user?" description="This action cannot be undone. The user will be permanently deleted." />

      {/* Bulk Delete Dialog */}
      <DeleteDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} isDeleting={isBulkDeleting} onConfirm={handleConfirmBulkDelete} title={`Delete ${selectedUsers.size} users?`} description={`Are you sure you want to delete ${selectedUsers.size} selected users? This action cannot be undone.`} confirmLabel={`Delete ${selectedUsers.size} Users`} />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedUserIds={Array.from(selectedUsers)}
        roles={roles}
        brands={brands}
        onSuccess={() => { setSelectedUsers(new Set()); refetch(); }}
      />

      {/* Drawer */}
      <InviteDrawer open={drawerOpen} onOpenChange={setDrawerOpen} roles={roles} brands={brands} editUser={editUser} />
    </div>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ open, onOpenChange, isDeleting, onConfirm, title, description, confirmLabel = "Delete" }: {
  open: boolean; onOpenChange: (v: boolean) => void; isDeleting: boolean; onConfirm: () => void;
  title: string; description: string; confirmLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="px-8 py-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-8">{description}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting} className="flex-1 h-12 text-base font-medium cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className="flex-1 h-12 text-base font-medium cursor-pointer">
              {isDeleting ? "Deleting..." : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
