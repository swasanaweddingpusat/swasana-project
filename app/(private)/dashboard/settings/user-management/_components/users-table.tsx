"use client";

import { useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { resendInvitation } from "@/actions/user";
import type { UsersQueryResult, UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { UserFilters } from "@/types/user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TrashBinTrash, PenNewSquare, Letter, MenuDots, ArrowLeft, ArrowRight,
  CloseCircle, UserPlus, Filter, Refresh,
} from "@solar-icons/react";

// ─── Skeleton Components ───────────────────────────────────────────────────────

const ROWS_PER_PAGE = 10;

function SkeletonTableBody({ rows = ROWS_PER_PAGE }: { rows?: number }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="border-b border-gray-100">
          <TableCell className="px-4 py-2.5">
            <Skeleton className="h-4 w-4 rounded-sm" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-4 w-5 rounded" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 rounded" style={{ width: `${80 + (i % 5) * 16}px` }} />
              </div>
            </div>
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-3.5 rounded" style={{ width: `${100 + (i % 4) * 20}px` }} />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-3.5 w-24 rounded" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell className="px-2 py-2.5">
            <div className="flex items-center justify-end">
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRoleBadgeClass = () => "bg-secondary text-secondary-foreground";

const getStatusBadgeClass = (verified: boolean) =>
  verified ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsersTableProps {
  initialData: UsersQueryResult;
  roles: RolesQueryResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UsersTable({ initialData, roles }: UsersTableProps) {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilterRaw] = useState("");
  const [statusFilter, setStatusFilterRaw] = useState("");
  const [searchQuery, setSearchQueryRaw] = useState("");

  const rowsPerPage = ROWS_PER_PAGE;

  const setRoleFilter = (v: string) => { setRoleFilterRaw(v); setPage(1); };
  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setPage(1); };
  const setSearchQuery = (v: string) => { setSearchQueryRaw(v); setPage(1); };

  const filters: UserFilters = {
    search: searchQuery || undefined,
    roleId: roleFilter || undefined,
    status: (statusFilter || undefined) as UserFilters["status"],
    page,
    limit: rowsPerPage,
  };

  const { data, refetch, isRefetching, isLoading, isFetching } = useUsers(initialData, filters);
  const users: UserQueryItem[] = useMemo(() => data?.users ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / rowsPerPage);

  const deleteUserMutation = useDeleteUser();

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

  const headerCheckboxRef = useRef<HTMLButtonElement>(null);

  const hasFilters = !!(roleFilter || statusFilter);
  const clearFilters = () => { setRoleFilter(""); setStatusFilter(""); };

  const paginatedUsers = users; // sudah dipaginasi server-side

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
    const succeeded = results.filter(
      r => r.status === "fulfilled" && r.value.success === true
    ).length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(`${succeeded} user berhasil dihapus`);
      await refetch();
    }
    if (failed > 0) toast.error(`${failed} user gagal dihapus`);
    setSelectedUsers(new Set());
    setBulkDeleteOpen(false);
    setIsBulkDeleting(false);
  };

  // Initial load: full skeleton card (no data yet, no header to show)
  if (isLoading) {
    return (
      <Card className={cn('p-0', 'shadow-none')}>
        <CardContent className="p-0">
          <div className={cn('px-6', 'py-4', 'space-y-3')}>
            <div className={cn('flex', 'items-center', 'justify-between')}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 flex-1 lg:flex-none lg:w-64 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg hidden lg:block" />
              <Skeleton className="h-8 w-28 rounded-lg hidden lg:block" />
            </div>
          </div>
          <div className={cn('relative', 'overflow-x-auto', 'w-full')}>
            <Table className={cn('min-w-full', 'text-xs')}>
              <TableHeader>
                <TableRow className={cn('border-b-2', 'border-border', 'bg-secondary')}>
                  <TableHead className="px-4 py-2.5"><Skeleton className="h-4 w-4 rounded-sm" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-5 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-12 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-12 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-10 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-24 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5"><Skeleton className="h-3.5 w-14 rounded" /></TableHead>
                  <TableHead className="px-2 py-2.5" />
                </TableRow>
              </TableHeader>
              <SkeletonTableBody rows={ROWS_PER_PAGE} />
            </Table>
          </div>
          <div className={cn('flex', 'justify-between', 'items-center', 'px-6', 'py-3', 'border-t')}>
            <Skeleton className="h-8 w-24 rounded-lg" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-8 rounded-md" />
              <Skeleton className="h-6 w-8 rounded-md" />
              <Skeleton className="h-6 w-8 rounded-md" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card className={cn('p-0', 'shadow-none')}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('px-6', 'py-4', 'space-y-3')}>
            {/* Top row */}
            <div className={cn('flex', 'items-center', 'justify-between')}>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <span className={cn('text-base', 'font-bold', 'text-foreground')}>List Users</span>
                <span className={cn('text-[11px]', 'font-medium', 'bg-secondary', 'text-secondary-foreground', 'px-2.5', 'py-0.5', 'border', 'border-border', 'rounded-full')}>
                  {total} Users available
                </span>
              </div>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                {selectedUsers.size > 1 && (
                  <>
                    <Button variant="outline" size="sm" className={cn('flex', 'items-center', 'gap-1.5', 'h-8', 'text-xs')} onClick={() => setBulkEditOpen(true)}>
                      <PenNewSquare weight="BoldDuotone" className={cn('w-3.5', 'h-3.5')} /> Edit ({selectedUsers.size})
                    </Button>
                    <Button variant="destructive" size="sm" className={cn('flex', 'items-center', 'gap-1.5', 'h-8', 'text-xs')} onClick={() => setBulkDeleteOpen(true)}>
                      <TrashBinTrash weight="BoldDuotone" className={cn('w-3.5', 'h-3.5')} /> Delete ({selectedUsers.size})
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={handleAddNew} className={cn('flex', 'items-center', 'gap-1.5', 'text-xs', 'h-8')}>
                  <UserPlus weight="BoldDuotone" className={cn('w-3.5', 'h-3.5')} /> Invite User
                </Button>
              </div>
            </div>

            {/* Bottom row: Search + Filters */}
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <Input
                placeholder="Cari nama, email..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className={cn('h-8', 'text-xs', 'border-border', 'bg-secondary', 'flex-1', 'lg:flex-none', 'lg:w-64')}
              />

              {/* Desktop filters */}
              <div className={cn('hidden', 'lg:flex', 'items-center', 'gap-2')}>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className={cn('h-8', 'w-28', 'text-xs', 'border-border', 'bg-secondary')}><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={cn('h-8', 'w-28', 'text-xs', 'border-border', 'bg-secondary')}><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className={cn('h-8', 'px-2', 'border-border', 'bg-secondary', 'hover:bg-accent')}
                  title="Refresh data"
                >
                  <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5 text-muted-foreground", isRefetching && "animate-spin")} />
                </Button>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className={cn('h-8', 'px-2', 'text-muted-foreground', 'hover:text-foreground')}>
                    <CloseCircle weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                  </Button>
                )}
              </div>

              {/* Mobile filter */}
              <div className="lg:hidden">
                <Button variant="outline" size="sm" className={cn("h-8 w-8 p-0 border-gray-200", hasFilters && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}>
                  <Filter weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
          </div>

          {/* Empty state (shared) */}
          {!isFetching && paginatedUsers.length === 0 ? (
            <div className={cn('flex', 'justify-center', 'items-center', 'py-8')}>
              <div className={cn('text-xs', 'text-gray-500')}>No users found</div>
            </div>
          ) : (
          <>
          {/* Table — desktop (sm+) */}
          <div className={cn('relative', 'hidden', 'sm:block', 'overflow-x-auto', 'w-full')}>
              <Table className={cn('min-w-full', 'text-xs')}>
                <TableHeader>
                  <TableRow className={cn('border-b-2', 'border-border', 'bg-secondary')}>
                    <TableHead className={cn('px-4', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>
                      <Checkbox ref={headerCheckboxRef} checked={isAllSelected} onCheckedChange={handleSelectAll} className="cursor-pointer" />
                    </TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs', 'w-10')}>No</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Nama</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Email</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Role</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Data Access</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Created Date</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs')}>Status</TableHead>
                    <TableHead className={cn('px-2', 'py-2.5', 'font-semibold', 'text-muted-foreground', 'text-xs', 'text-right')}>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                {isFetching ? (
                  <SkeletonTableBody rows={Math.max(paginatedUsers.length, ROWS_PER_PAGE)} />
                ) : (
                <TableBody>
                  {paginatedUsers.map((user, index) => {
                    const roleName = user.profile?.role?.name ?? "";
                    const isVerified = user.profile?.isEmailVerified ?? false;
                    const dataScope = user.profile?.dataScope ?? "own";
                    const rowNumber = (page - 1) * rowsPerPage + index + 1;
                    const createdDate = user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                      : "—";
                    return (
                      <TableRow key={user.id} className={cn('border-b', 'border-gray-100', 'hover:bg-gray-50')}>
                        <TableCell className={cn('px-4', 'py-2.5')}>
                          <Checkbox checked={selectedUsers.has(user.id)} onCheckedChange={(c) => handleSelectUser(user.id, c as boolean)} className="cursor-pointer" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2.5', 'text-xs', 'text-muted-foreground')}>{rowNumber}</TableCell>
                        <TableCell className={cn('px-2', 'py-2.5')}>
                          <div className={cn('flex', 'items-center', 'gap-2')}>
                            <ProfileAvatar name={user.profile?.fullName ?? user.email} src={user.profile?.avatarUrl ?? undefined} size="sm" />
                            <div className={cn('flex', 'flex-col', 'gap-0.5')}>
                              <span className={cn('font-medium', 'text-xs')}>{user.profile?.fullName ?? user.name ?? "—"}</span>
                              {(user.profile?.dataGroupMemberships?.length ?? 0) > 0 && (
                                <div className={cn('flex', 'flex-wrap', 'gap-1')}>
                                  {user.profile!.dataGroupMemberships!.map((m) => (
                                    <span key={m.group.id} className={cn('px-1.5', 'py-0.5', 'text-[10px]', 'bg-secondary', 'text-secondary-foreground', 'rounded-full', 'border')}>{m.group.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2.5', 'text-xs', 'text-muted-foreground')}>{user.email}</TableCell>
                        <TableCell className={cn('px-2', 'py-2.5')}>
                          {roleName ? (
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", getRoleBadgeClass())}>
                              {roleName}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2.5')}>
                          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground')}>
                            {dataScope}
                          </span>
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2.5', 'text-xs', 'text-muted-foreground')}>{createdDate}</TableCell>
                        <TableCell className={cn('px-2', 'py-2.5')}>
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", getStatusBadgeClass(isVerified))}>
                            {isVerified ? "Verified" : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2.5')}>
                          <div className={cn('flex', 'items-center', 'justify-end', 'gap-1')}>
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn('p-1', 'hover:bg-gray-100', 'rounded', 'cursor-pointer', 'outline-none')} title="Actions">
                                <MenuDots weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'text-muted-foreground')} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <PenNewSquare weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-2', 'text-primary')} /> Edit
                                </DropdownMenuItem>
                                {!isVerified && (
                                  <DropdownMenuItem onClick={() => handleResend(user)} disabled={resendingId === user.profile?.id}>
                                    <Letter weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-2', 'text-primary')} /> {resendingId === user.profile?.id ? "Sending..." : "Resend Invitation"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { setUserToDelete(user); setDeleteConfirmOpen(true); }} className="text-destructive focus:text-destructive">
                                  <TrashBinTrash weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-2')} /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                )}
              </Table>
          </div>

          {/* Mobile (<sm): card list */}
          <div className={cn('block', 'sm:hidden', 'p-4', 'space-y-3')}>
            {paginatedUsers.map((user, index) => {
              const roleName = user.profile?.role?.name ?? "";
              const isVerified = user.profile?.isEmailVerified ?? false;
              const dataScope = user.profile?.dataScope ?? "own";
              const rowNumber = (page - 1) * rowsPerPage + index + 1;
              const createdDate = user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                : "—";
              return (
                <div
                  key={user.id}
                  className={cn('rounded-lg', 'border', 'bg-card', 'p-3', 'space-y-2', selectedUsers.has(user.id) && "border-primary/40 bg-primary/5")}
                >
                  {/* Row 1: checkbox + avatar + name + status badge */}
                  <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                    <div className={cn('flex', 'items-center', 'gap-2', 'min-w-0')}>
                      <Checkbox checked={selectedUsers.has(user.id)} onCheckedChange={(c) => handleSelectUser(user.id, c as boolean)} className="cursor-pointer shrink-0" />
                      <ProfileAvatar name={user.profile?.fullName ?? user.email} src={user.profile?.avatarUrl ?? undefined} size="sm" />
                      <div className="min-w-0">
                        <p className={cn('font-medium', 'text-sm', 'text-foreground', 'truncate')}>
                          {rowNumber}. {user.profile?.fullName ?? user.name ?? "—"}
                        </p>
                        <p className={cn('text-xs', 'text-muted-foreground', 'truncate')}>{user.email}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium", getStatusBadgeClass(isVerified))}>
                      {isVerified ? "Verified" : "Pending"}
                    </span>
                  </div>

                  {/* Row 2: role + data access + created date */}
                  <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs', 'text-muted-foreground')}>
                    {roleName && (
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", getRoleBadgeClass())}>{roleName}</span>
                    )}
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground')}>{dataScope}</span>
                    <span aria-hidden="true">·</span>
                    <span>{createdDate}</span>
                  </div>

                  {/* Group memberships */}
                  {(user.profile?.dataGroupMemberships?.length ?? 0) > 0 && (
                    <div className={cn('flex', 'flex-wrap', 'gap-1')}>
                      {user.profile!.dataGroupMemberships!.map((m) => (
                        <span key={m.group.id} className={cn('px-1.5', 'py-0.5', 'text-[10px]', 'bg-secondary', 'text-secondary-foreground', 'rounded-full', 'border')}>{m.group.name}</span>
                      ))}
                    </div>
                  )}

                  {/* Footer: actions */}
                  <div className={cn('flex', 'items-center', 'gap-1', 'pt-1', 'border-t', 'border-border')}>
                    <Button
                      variant="outline"
                      className={cn('h-9', 'flex-1', 'text-xs')}
                      onClick={() => handleEdit(user)}
                      aria-label={`Edit ${user.profile?.fullName ?? user.email}`}
                    >
                      <PenNewSquare weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Edit
                    </Button>
                    {!isVerified && (
                      <Button
                        variant="outline"
                        className={cn('h-9', 'flex-1', 'text-xs')}
                        onClick={() => handleResend(user)}
                        disabled={resendingId === user.profile?.id}
                        aria-label={`Resend invitation ${user.email}`}
                      >
                        <Letter weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> {resendingId === user.profile?.id ? "..." : "Resend"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn('h-9', 'w-9', 'shrink-0', 'text-destructive', 'hover:text-destructive', 'hover:bg-destructive/10')}
                      onClick={() => { setUserToDelete(user); setDeleteConfirmOpen(true); }}
                      aria-label={`Delete ${user.profile?.fullName ?? user.email}`}
                    >
                      <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className={cn('h-4', 'w-4')} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-6', 'py-3', 'border-t')}>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className={cn('text-xs', 'h-8')}>
                <ArrowLeft weight="BoldDuotone" className={cn('w-3.5', 'h-3.5', 'mr-1.5')} /> Previous
              </Button>
              <div className={cn('flex', 'items-center', 'gap-1')}>
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                  else {
                    pages.push(1);
                    if (page > 3) pages.push("...");
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                    if (page < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    typeof p === "string" ? (
                      <span key={`e-${idx}`} className={cn('px-2', 'py-1', 'text-xs', 'text-gray-400')}>...</span>
                    ) : (
                      <button key={p} className={cn("px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer", page === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary")} onClick={() => setPage(p)}>
                        {p}
                      </button>
                    )
                  );
                })()}
              </div>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className={cn('text-xs', 'h-8')}>
                Next <ArrowRight weight="BoldDuotone" className={cn('w-3.5', 'h-3.5', 'ml-1.5')} />
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
        onSuccess={() => { setSelectedUsers(new Set()); refetch(); }}
      />

      {/* Drawer */}
      <InviteDrawer open={drawerOpen} onOpenChange={setDrawerOpen} roles={roles} editUser={editUser} />
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
      <DialogContent className={cn('max-w-sm', 'p-0', 'gap-0', 'overflow-hidden', 'rounded-2xl', 'border-0', 'shadow-xl')} showCloseButton={false}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={cn('px-8', 'py-8')}>
          <h3 className={cn('text-xl', 'font-semibold', 'text-gray-900', 'mb-2')}>{title}</h3>
          <p className={cn('text-gray-600', 'mb-8')}>{description}</p>
          <div className={cn('flex', 'gap-3')}>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting} className={cn('flex-1', 'h-12', 'text-base', 'font-medium', 'cursor-pointer')}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className={cn('flex-1', 'h-12', 'text-base', 'font-medium', 'cursor-pointer')}>
              {isDeleting ? "Deleting..." : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
