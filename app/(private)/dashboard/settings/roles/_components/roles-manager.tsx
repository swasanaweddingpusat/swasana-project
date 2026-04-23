"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ShieldCheck, Plus, Loader2, PenLine, Trash2, GripVertical, MoreHorizontal, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  useRoles, useCreateRole, useUpdateRole, useDeleteRole,
  useUpdateRolePermissions, useReorderRoles, useCreatePermission,
  useDeletePermission, useDeleteModulePermissions, useUpdatePermission,
  useReorderModules, useRenameModule,
} from "@/hooks/use-roles";
import type { RolesQueryResult, RoleQueryItem } from "@/lib/queries/roles";
import type { PermissionsQueryResult, PermissionQueryItem } from "@/lib/queries/permissions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ─── Config ───────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", customers: "Customers", booking: "Booking",
  calendar_event: "Calendar Event", hr: "HR & Payroll",
  finance_ar: "Accounts Receivable", finance_ap: "Accounts Payable",
  package: "Package", venue: "Venue", vendor: "Vendor",
  user_management: "User Management", role_permission: "Role & Permission",
  venue_management: "Venue Management", brand_management: "Brand Management",
  payment_methods: "Payment Methods", source_of_information: "Source of Info",
  settings: "Settings", addons: "Addons", purchase_order: "Purchase Order",
  attendance: "Attendance",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  approve: "Approve", approve_finance: "Approve (Finance)",
  approve_manager: "Approve (Manager)", approve_oprations: "Approve (Ops)",
  mark_lost: "Mark Lost", restore: "Restore", print: "Print", view_all: "View All",
};

const roleColors: Record<string, string> = {
  "super admin": "bg-gray-900 text-white", manager: "bg-gray-700 text-white",
  sales: "bg-gray-500 text-white", finance: "bg-gray-600 text-white",
  "vendor specialist": "bg-gray-400 text-white", operational: "bg-gray-500 text-white",
  "direktur sales": "bg-gray-700 text-white", "direktur operational": "bg-gray-700 text-white",
  "human resource": "bg-gray-600 text-white",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RolesManagerProps {
  initialRoles: RolesQueryResult;
  initialPermissions: PermissionsQueryResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RolesManager({ initialRoles, initialPermissions }: RolesManagerProps) {
  const { data: rolesData } = useRoles(initialRoles);
  const roles: RoleQueryItem[] = useMemo(
    () => [...(rolesData ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [rolesData]
  );

  // Permissions as state so new ones appear immediately
  const [permissions, setPermissions] = useState<PermissionsQueryResult>(initialPermissions);

  const createRoleMut = useCreateRole();
  const updateRoleMut = useUpdateRole();
  const deleteRoleMut = useDeleteRole();
  const updatePermsMut = useUpdateRolePermissions();
  const reorderMut = useReorderRoles();
  const createPermMut = useCreatePermission();
  const deletePermMut = useDeletePermission();
  const deleteModuleMut = useDeleteModulePermissions();
  const updatePermMut = useUpdatePermission();
  const reorderModulesMut = useReorderModules();
  const renameModuleMut = useRenameModule();

  // Local module order (for optimistic drag & drop)
  const [localModuleOrder, setLocalModuleOrder] = useState<string[]>([]);

  // Edit permission inline
  const [editPermId, setEditPermId] = useState<string | null>(null);
  const [editPermAction, setEditPermAction] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(initialRoles[0]?.id ?? null);

  // Local permission state per role
  const [localPerms, setLocalPerms] = useState<Record<string, Set<string>>>(() => {
    const state: Record<string, Set<string>> = {};
    initialRoles.forEach((r) => {
      state[r.id] = new Set(r.rolePermissions.map((rp) => rp.permission.id));
    });
    return state;
  });
  const [isDirty, setIsDirty] = useState(false);

  // Sync localPerms when roles data changes (new roles added, etc.)
  useEffect(() => {
    if (!roles.length) return;
    setLocalPerms((prev) => {
      const next = { ...prev };
      roles.forEach((r) => {
        if (!next[r.id]) {
          next[r.id] = new Set(r.rolePermissions.map((rp) => rp.permission.id));
        }
      });
      return next;
    });
  }, [roles]);

  // Add role
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Edit role
  const [editingRole, setEditingRole] = useState<RoleQueryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete role
  const [deletingRole, setDeletingRole] = useState<RoleQueryItem | null>(null);

  // Add permission (inline per module)
  const [addPermModule, setAddPermModule] = useState<string | null>(null);
  const [newAction, setNewAction] = useState("");

  // Add new module
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");

  // Edit module name
  const [editModuleKey, setEditModuleKey] = useState<string | null>(null);
  const [editModuleName, setEditModuleName] = useState("");

  // Accordion open state
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  // ─── Derived ──────────────────────────────────────────────────────────────

  const moduleActions = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    permissions.forEach((p: PermissionQueryItem) => {
      if (!map[p.module]) map[p.module] = new Set();
      map[p.module].add(p.action);
    });
    return map;
  }, [permissions]);

  const modules = useMemo(() => Object.keys(moduleActions).sort(), [moduleActions]);

  // Sync localModuleOrder when permissions change
  useEffect(() => {
    const mods = Object.keys(moduleActions);
    setLocalModuleOrder((prev) => {
      // Keep existing order, append new modules
      const existing = prev.filter((m) => mods.includes(m));
      const newMods = mods.filter((m) => !prev.includes(m));
      return [...existing, ...newMods];
    });
  }, [moduleActions]);

  const permLookup = useMemo(() => {
    const map: Record<string, string> = {};
    permissions.forEach((p: PermissionQueryItem) => { map[`${p.module}:${p.action}`] = p.id; });
    return map;
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isSuperAdmin = false; // All roles can be edited
  const currentPerms = selectedRoleId ? localPerms[selectedRoleId] ?? new Set<string>() : new Set<string>();

  // ─── Permission handlers ──────────────────────────────────────────────────

  const togglePermission = useCallback((mod: string, action: string) => {
    if (!selectedRoleId || isSuperAdmin) return;
    const pid = permLookup[`${mod}:${action}`];
    if (!pid) return;
    setLocalPerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[selectedRoleId]);
      set.has(pid) ? set.delete(pid) : set.add(pid);
      next[selectedRoleId] = set;
      return next;
    });
    setIsDirty(true);
  }, [selectedRoleId, isSuperAdmin, permLookup]);

  const toggleAllForModule = useCallback((mod: string) => {
    if (!selectedRoleId || isSuperAdmin) return;
    const pids = Array.from(moduleActions[mod] ?? []).map((a) => permLookup[`${mod}:${a}`]).filter(Boolean);
    setLocalPerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[selectedRoleId]);
      const allChecked = pids.every((pid) => set.has(pid));
      pids.forEach((pid) => allChecked ? set.delete(pid) : set.add(pid));
      next[selectedRoleId] = set;
      return next;
    });
    setIsDirty(true);
  }, [selectedRoleId, isSuperAdmin, permLookup, moduleActions]);

  const handleSave = async () => {
    if (!selectedRoleId) return;
    const res = await updatePermsMut.mutateAsync({ roleId: selectedRoleId, permissionIds: Array.from(currentPerms) });
    if (res.success) { toast.success("Permissions saved"); setIsDirty(false); }
    else toast.error(res.error ?? "Failed");
  };

  const handleReset = () => {
    if (!selectedRoleId) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) return;
    setLocalPerms((prev) => ({ ...prev, [selectedRoleId]: new Set(role.rolePermissions.map((rp) => rp.permission.id)) }));
    setIsDirty(false);
  };

  // ─── Role handlers ────────────────────────────────────────────────────────

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    const fd = new FormData();
    fd.set("name", newRoleName.trim());
    if (newRoleDesc.trim()) fd.set("description", newRoleDesc.trim());
    const res = await createRoleMut.mutateAsync(fd);
    if (res.success && res.role) {
      toast.success("Role created");
      setNewRoleName(""); setNewRoleDesc(""); setShowAddRole(false);
      setSelectedRoleId(res.role.id);
    } else toast.error(res.error ?? "Failed");
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editName.trim()) return;
    const fd = new FormData();
    fd.set("id", editingRole.id);
    fd.set("name", editName.trim());
    if (editDesc.trim()) fd.set("description", editDesc.trim());
    const res = await updateRoleMut.mutateAsync(fd);
    if (res.success) { toast.success("Role updated"); setEditingRole(null); }
    else toast.error(res.error ?? "Failed");
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    const res = await deleteRoleMut.mutateAsync(deletingRole.id);
    if (res.success) {
      toast.success("Role deleted");
      setDeletingRole(null);
      if (selectedRoleId === deletingRole.id) setSelectedRoleId(roles[0]?.id ?? null);
    } else toast.error(res.error ?? "Failed");
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(roles);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    await reorderMut.mutateAsync(reordered.map((r) => r.id));
  };

  // ─── Add Permission inline ────────────────────────────────────────────────

  const handleModuleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(localModuleOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setLocalModuleOrder(reordered); // optimistic
    await reorderModulesMut.mutateAsync(reordered);
  };

  const handleAddModule = async () => {
    if (!newModuleName.trim()) return;
    const mod = newModuleName.trim().toLowerCase().replace(/\s+/g, "_");
    const res = await createPermMut.mutateAsync({ module: mod, action: "view" });
    if (res.success && res.permission) {
      toast.success(`Module "${mod}" created`);
      setPermissions((prev) => [...prev, res.permission!]);
      setOpenModules((prev) => new Set([...prev, mod]));
      setNewModuleName("");
      setShowAddModule(false);
    } else toast.error(res.error ?? "Failed");
  };

  const handleAddPermission = async (mod: string) => {
    if (!newAction.trim()) return;
    const res = await createPermMut.mutateAsync({ module: mod, action: newAction.trim().toLowerCase() });
    if (res.success && res.permission) {
      toast.success("Permission added");
      setPermissions((prev) => [...prev, res.permission!]);
      setNewAction("");
      setAddPermModule(null);
    } else toast.error(res.error ?? "Failed");
  };

  const handleUpdatePermission = async (permId: string) => {
    if (!editPermAction.trim()) return;
    const res = await updatePermMut.mutateAsync({ permissionId: permId, action: editPermAction });
    if (res.success && res.permission) {
      toast.success("Permission updated");
      setPermissions((prev) => prev.map((p) => p.id === permId ? { ...p, action: res.permission!.action } : p));
      setEditPermId(null);
      setEditPermAction("");
    } else toast.error(res.error ?? "Failed");
  };

  const handleDeletePermission = async (permId: string, mod: string, action: string) => {
    const res = await deletePermMut.mutateAsync(permId);
    if (res.success) {
      toast.success("Permission deleted");
      setPermissions((prev) => prev.filter((p) => p.id !== permId));
      // Remove from localPerms
      setLocalPerms((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((roleId) => {
          const set = new Set(next[roleId]);
          set.delete(permId);
          next[roleId] = set;
        });
        return next;
      });
    } else toast.error(res.error ?? "Failed");
  };

  const handleRenameModule = async () => {
    if (!editModuleKey || !editModuleName.trim()) return;
    const res = await renameModuleMut.mutateAsync({ oldModule: editModuleKey, newModule: editModuleName.trim() });
    if ("error" in res) { toast.error(res.error); return; }
    toast.success(`Module renamed to "${res.newModule}"`);
    setPermissions((prev) => prev.map((p) => p.module === editModuleKey ? { ...p, module: res.newModule! } : p));
    setEditModuleKey(null);
    setEditModuleName("");
  };

  const handleDeleteModule = async (mod: string) => {
    const modPermIds = permissions.filter((p) => p.module === mod).map((p) => p.id);
    const res = await deleteModuleMut.mutateAsync(mod);
    if (res.success) {
      toast.success(`Module "${mod}" deleted`);
      setPermissions((prev) => prev.filter((p) => p.module !== mod));
      setLocalPerms((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((roleId) => {
          const set = new Set(next[roleId]);
          modPermIds.forEach((id) => set.delete(id));
          next[roleId] = set;
        });
        return next;
      });
    } else toast.error(res.error ?? "Failed");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col mb-6 px-2">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Roles List ── */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
              <button onClick={() => setShowAddRole(!showAddRole)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="p-2">
              {showAddRole && (
                <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <Input placeholder="Nama role" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="text-sm h-8" autoFocus />
                  <Input placeholder="Deskripsi (opsional)" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} className="text-sm h-8" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateRole} disabled={!newRoleName.trim() || createRoleMut.isPending} className="flex-1 h-7 text-xs">
                      {createRoleMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Tambah
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddRole(false); setNewRoleName(""); setNewRoleDesc(""); }} className="h-7 text-xs">Batal</Button>
                  </div>
                </div>
              )}

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="roles">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {roles.map((role, idx) => (
                        <Draggable key={role.id} draggableId={role.id} index={idx}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                                selectedRoleId === role.id ? "bg-gray-100" : "hover:bg-gray-50"
                              } ${snapshot.isDragging ? "shadow-md bg-white" : ""}`}
                            >
                              <div {...drag.dragHandleProps} className="cursor-grab opacity-0 group-hover:opacity-40 hover:!opacity-70 shrink-0">
                                <GripVertical className="h-4 w-4 text-gray-400" />
                              </div>
                              <button onClick={() => { setSelectedRoleId(role.id); setIsDirty(false); }} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${roleColors[role.name.toLowerCase()] ?? "bg-gray-300 text-white"}`}>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate capitalize">{role.name}</p>
                                  {role.description && <p className="text-xs text-gray-400 truncate">{role.description}</p>}
                                </div>
                              </button>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                <button className="p-1 hover:bg-gray-200 rounded cursor-pointer" onClick={() => { setEditingRole(role); setEditName(role.name); setEditDesc(role.description ?? ""); }}>
                                  <PenLine className="h-3 w-3 text-gray-500" />
                                </button>
                                {role.name.toLowerCase() !== "super admin" && (
                                  <button className="p-1 hover:bg-red-100 rounded cursor-pointer" onClick={() => setDeletingRole(role)}>
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>
        </div>

        {/* ── Permission Matrix ── */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-lg">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Permissions — <span className="capitalize">{selectedRole?.name ?? "—"}</span>
                </h2>
                {selectedRole?.description && <p className="text-xs text-gray-500 mt-0.5">{selectedRole.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddModule(true)} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Module
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset} disabled={!isDirty || isSuperAdmin} className="h-7 text-xs">Reset</Button>
                <Button size="sm" onClick={handleSave} disabled={!isDirty || isSuperAdmin || updatePermsMut.isPending} className="h-7 text-xs gap-1">
                  {updatePermsMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Save
                </Button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              {/* Add Module inline form */}
              {showAddModule && (
                <div className="flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                  <Input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="Nama module baru (e.g. booking)"
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddModule(); if (e.key === "Escape") { setShowAddModule(false); setNewModuleName(""); } }}
                  />
                  <Button size="sm" onClick={handleAddModule} disabled={!newModuleName.trim() || createPermMut.isPending} className="h-8 text-xs">
                    {createPermMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddModule(false); setNewModuleName(""); }} className="h-8 text-xs">Cancel</Button>
                </div>
              )}
              <DragDropContext onDragEnd={handleModuleDragEnd}>
                <Droppable droppableId="modules">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {localModuleOrder.filter((mod) => moduleActions[mod]).map((mod, idx) => (
                        <Draggable key={mod} draggableId={mod} index={idx}>
                          {(drag, snapshot) => (
                            <div ref={drag.innerRef} {...drag.draggableProps} className={snapshot.isDragging ? "shadow-lg" : ""}>
                              {(() => {
                const actions = Array.from(moduleActions[mod]).sort();
                const pids = actions.map((a) => permLookup[`${mod}:${a}`]).filter(Boolean);
                const checkedCount = pids.filter((pid) => currentPerms.has(pid)).length;
                const allChecked = pids.length > 0 && checkedCount === pids.length;
                const isOpen = openModules.has(mod);

                return (
                  <div key={mod} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Accordion Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      {/* Drag handle */}
                      <div {...drag.dragHandleProps} className="cursor-grab opacity-40 hover:opacity-70 shrink-0">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                      </div>
                      {/* Toggle All */}
                      <Switch
                        checked={allChecked}
                        onCheckedChange={() => toggleAllForModule(mod)}
                      />

                      {/* Module name */}
                      <button
                        className="flex-1 text-left flex items-center gap-2 cursor-pointer"
                        onClick={() => setOpenModules((prev) => { const n = new Set(prev); n.has(mod) ? n.delete(mod) : n.add(mod); return n; })}
                      >
                        <span className="text-sm font-medium text-gray-900">{MODULE_LABELS[mod] ?? mod}</span>
                        <span className="text-xs text-gray-400">{checkedCount}/{pids.length}</span>
                      </button>

                      {/* Actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-gray-200 rounded cursor-pointer">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => { setEditModuleKey(mod); setEditModuleName(MODULE_LABELS[mod] ?? mod); }}>
                            <PenLine className="h-3.5 w-3.5 mr-2" /> Edit Label
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setAddPermModule(mod); setNewAction(""); setOpenModules((p) => new Set([...p, mod])); }}>
                            <Plus className="h-3.5 w-3.5 mr-2" /> Tambah Permission
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteModule(mod)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus Module
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform cursor-pointer shrink-0 ${isOpen ? "rotate-180" : ""}`}
                        onClick={() => setOpenModules((prev) => { const n = new Set(prev); n.has(mod) ? n.delete(mod) : n.add(mod); return n; })}
                      />
                    </div>

                    {/* Accordion Body */}
                    {isOpen && (
                      <div className="px-4 py-3 bg-white">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                        {actions.map((action) => {
                          const pid = permLookup[`${mod}:${action}`];
                          const checked = pid ? currentPerms.has(pid) : false;
                          const isEditing = editPermId === pid;
                          return (
                            <div key={action} className="group/perm flex items-center justify-between py-1">
                              <div className="flex items-center gap-3 flex-1">
                                {/* Toggle per permission */}
                                <Switch
                                  checked={checked}
                                  onCheckedChange={() => togglePermission(mod, action)}
                                  disabled={!pid}
                                />

                                {/* Action name — inline edit */}
                                {isEditing && pid ? (
                                  <div className="flex items-center gap-1">
                                    <Input value={editPermAction} onChange={(e) => setEditPermAction(e.target.value)} className="h-6 text-xs w-28 px-2" autoFocus
                                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdatePermission(pid); if (e.key === "Escape") { setEditPermId(null); setEditPermAction(""); } }} />
                                    <button onClick={() => handleUpdatePermission(pid)} disabled={!editPermAction.trim()} className="p-0.5 hover:bg-gray-200 rounded cursor-pointer disabled:opacity-50">
                                      <span className="text-xs text-green-600 font-medium">✓</span>
                                    </button>
                                    <button onClick={() => { setEditPermId(null); setEditPermAction(""); }} className="p-0.5 hover:bg-gray-200 rounded cursor-pointer">
                                      <span className="text-xs text-red-400">✕</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-700">{ACTION_LABELS[action] ?? action}</span>
                                )}
                              </div>

                              {/* Edit / Delete icons */}
                              {!isEditing && pid && (
                                <div className="opacity-0 group-hover/perm:opacity-100 flex items-center gap-1 transition-opacity">
                                  <button onClick={() => { setEditPermId(pid); setEditPermAction(action); }} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                                    <PenLine className="h-3 w-3 text-gray-400" />
                                  </button>
                                  <button onClick={() => handleDeletePermission(pid, mod, action)} className="p-1 hover:bg-red-50 rounded cursor-pointer">
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>

                        {/* Inline add permission */}
                        {addPermModule === mod && (
                          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-100">
                            <Input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="nama action baru" className="h-7 text-xs flex-1" autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddPermission(mod); if (e.key === "Escape") { setAddPermModule(null); setNewAction(""); } }} />
                            <button onClick={() => handleAddPermission(mod)} disabled={!newAction.trim() || createPermMut.isPending} className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer disabled:opacity-50">
                              {createPermMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                            </button>
                            <button onClick={() => { setAddPermModule(null); setNewAction(""); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 cursor-pointer">Cancel</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
              })()}
            </div>
          )}
        </Draggable>
      ))}
      {provided.placeholder}
    </div>
  )}
</Droppable>
</DragDropContext>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(o) => !o && setEditingRole(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Edit Role</DialogTitle>
          <div className="space-y-3 mt-2">
            <div><Label className="text-sm">Nama Role *</Label><Input className="mt-1" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label className="text-sm">Deskripsi</Label><Input className="mt-1" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setEditingRole(null)}>Batal</Button>
            <Button className="flex-1" onClick={handleUpdateRole} disabled={!editName.trim() || updateRoleMut.isPending}>
              {updateRoleMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={!!deletingRole} onOpenChange={(o) => !o && setDeletingRole(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Hapus Role</DialogTitle>
          <p className="text-sm text-muted-foreground">Hapus role <strong>{deletingRole?.name}</strong>? Semua user dengan role ini akan kehilangan akses.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingRole(null)}>Batal</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteRole} disabled={deleteRoleMut.isPending}>
              {deleteRoleMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Module Label Dialog */}
      <Dialog open={!!editModuleKey} onOpenChange={(o) => { if (!o) { setEditModuleKey(null); setEditModuleName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Rename Module</DialogTitle>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-gray-500">Module saat ini</Label>
              <p className="text-sm font-medium text-gray-900">{editModuleKey}</p>
            </div>
            <div>
              <Label>Nama baru</Label>
              <Input value={editModuleName} onChange={(e) => setEditModuleName(e.target.value)} placeholder="Nama module baru..."
                onKeyDown={(e) => { if (e.key === "Enter" && editModuleName.trim()) handleRenameModule(); }} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditModuleKey(null); setEditModuleName(""); }}>Batal</Button>
              <Button size="sm" disabled={!editModuleName.trim() || renameModuleMut.isPending} onClick={handleRenameModule}>
                {renameModuleMut.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
