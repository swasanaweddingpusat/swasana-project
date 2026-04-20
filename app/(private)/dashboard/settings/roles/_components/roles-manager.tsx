"use client";

import { useState, useMemo, useCallback } from "react";
import { ShieldCheck, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useRoles,
  useCreateRole,
  useUpdateRolePermissions,
} from "@/hooks/use-roles";
import type { RolesQueryResult, RoleQueryItem } from "@/lib/queries/roles";
import type { PermissionsQueryResult, PermissionQueryItem } from "@/lib/queries/permissions";

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTIONS = ["view", "create", "update", "delete"] as const;

const roleColors: Record<string, string> = {
  "super admin": "bg-gray-900 text-white",
  manager: "bg-gray-700 text-white",
  sales: "bg-gray-500 text-white",
  finance: "bg-gray-600 text-white",
  "vendor specialist": "bg-gray-400 text-white",
  operational: "bg-gray-500 text-white",
  "direktur sales": "bg-gray-700 text-white",
  "direktur operational": "bg-gray-700 text-white",
  "human resource": "bg-gray-600 text-white",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RolesManagerProps {
  initialRoles: RolesQueryResult;
  initialPermissions: PermissionsQueryResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RolesManager({ initialRoles, initialPermissions }: RolesManagerProps) {
  const { data: roles } = useRoles(initialRoles);
  const createRoleMutation = useCreateRole();
  const updatePermsMutation = useUpdateRolePermissions();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    initialRoles[0]?.id ?? null
  );

  // Local editable permission state: roleId → Set<permissionId>
  const [localPerms, setLocalPerms] = useState<Record<string, Set<string>>>(() => {
    const state: Record<string, Set<string>> = {};
    initialRoles.forEach((r: RoleQueryItem) => {
      state[r.id] = new Set(r.rolePermissions.map((rp) => rp.permission.id));
    });
    return state;
  });
  const [isDirty, setIsDirty] = useState(false);

  // Add role inline form
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Permission lookup: "module:action" → permissionId
  const permLookup = useMemo(() => {
    const map: Record<string, string> = {};
    initialPermissions.forEach((p: PermissionQueryItem) => {
      map[`${p.module}:${p.action}`] = p.id;
    });
    return map;
  }, [initialPermissions]);

  // Unique modules from permissions
  const modules = useMemo(() => {
    const seen = new Set<string>();
    return initialPermissions
      .map((p: PermissionQueryItem) => p.module)
      .filter((m: string) => {
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
      })
      .sort();
  }, [initialPermissions]);

  const selectedRole = roles?.find((r: RoleQueryItem) => r.id === selectedRoleId) ?? null;
  const isSuperAdmin = selectedRole?.name.toLowerCase() === "super admin";
  const currentPerms = selectedRoleId
    ? localPerms[selectedRoleId] ?? new Set<string>()
    : new Set<string>();

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const togglePermission = useCallback(
    (moduleId: string, action: string) => {
      if (!selectedRoleId || isSuperAdmin) return;
      const pid = permLookup[`${moduleId}:${action}`];
      if (!pid) return;
      setLocalPerms((prev) => {
        const next = { ...prev };
        const set = new Set(next[selectedRoleId]);
        if (set.has(pid)) set.delete(pid);
        else set.add(pid);
        next[selectedRoleId] = set;
        return next;
      });
      setIsDirty(true);
    },
    [selectedRoleId, isSuperAdmin, permLookup]
  );

  const toggleAllForModule = useCallback(
    (moduleId: string) => {
      if (!selectedRoleId || isSuperAdmin) return;
      const pids = ACTIONS.map((a) => permLookup[`${moduleId}:${a}`]).filter(Boolean);
      setLocalPerms((prev) => {
        const next = { ...prev };
        const set = new Set(next[selectedRoleId]);
        const allChecked = pids.every((pid) => set.has(pid));
        pids.forEach((pid) => (allChecked ? set.delete(pid) : set.add(pid)));
        next[selectedRoleId] = set;
        return next;
      });
      setIsDirty(true);
    },
    [selectedRoleId, isSuperAdmin, permLookup]
  );

  const handleSave = async () => {
    if (!selectedRoleId) return;
    const result = await updatePermsMutation.mutateAsync({
      roleId: selectedRoleId,
      permissionIds: Array.from(currentPerms),
    });
    if (result.success) {
      toast.success("Permissions berhasil disimpan");
      setIsDirty(false);
    } else {
      toast.error(result.error ?? "Gagal menyimpan permissions");
    }
  };

  const handleReset = () => {
    if (!selectedRoleId) return;
    const role = initialRoles.find((r: RoleQueryItem) => r.id === selectedRoleId);
    if (!role) return;
    setLocalPerms((prev) => ({
      ...prev,
      [selectedRoleId]: new Set(role.rolePermissions.map((rp) => rp.permission.id)),
    }));
    setIsDirty(false);
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    const fd = new FormData();
    fd.set("name", newRoleName.trim());
    if (newRoleDesc.trim()) fd.set("description", newRoleDesc.trim());
    const result = await createRoleMutation.mutateAsync(fd);
    if (result.success && result.role) {
      toast.success("Role berhasil dibuat");
      setNewRoleName("");
      setNewRoleDesc("");
      setShowAddRole(false);
      setSelectedRoleId(result.role.id);
      setLocalPerms((prev) => ({ ...prev, [result.role!.id]: new Set<string>() }));
    } else {
      toast.error(result.error ?? "Gagal membuat role");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col my-6 px-2">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Roles List (Left) ── */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
              <button
                onClick={() => setShowAddRole(!showAddRole)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Add Role"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="p-2">
              {/* Inline Add Role Form */}
              {showAddRole && (
                <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <input
                    type="text"
                    placeholder="Nama role"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Deskripsi (opsional)"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateRole}
                      disabled={!newRoleName.trim() || createRoleMutation.isPending}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {createRoleMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Tambah
                    </button>
                    <button
                      onClick={() => { setShowAddRole(false); setNewRoleName(""); setNewRoleDesc(""); }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Role buttons */}
              {roles?.map((role: RoleQueryItem) => (
                <button
                  key={role.id}
                  onClick={() => { setSelectedRoleId(role.id); setIsDirty(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selectedRoleId === role.id
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    roleColors[role.name.toLowerCase()] ?? "bg-gray-300 text-white"
                  }`}>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate capitalize">{role.name}</p>
                    <p className="text-xs text-gray-400 truncate">{role.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Permission Matrix (Right) ── */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg">
            {/* Header with Save/Reset */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-lg">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Permissions — <span className="capitalize">{selectedRole?.name ?? "—"}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedRole?.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={!isDirty || isSuperAdmin}
                  className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSuperAdmin || updatePermsMutation.isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {updatePermsMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-48">
                      Module
                    </th>
                    {ACTIONS.map((action) => (
                      <th key={action} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">
                        {action}
                      </th>
                    ))}
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">
                      All
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod: string) => {
                    const modPids = ACTIONS.map((a) => permLookup[`${mod}:${a}`]).filter(Boolean);
                    const allChecked = isSuperAdmin || modPids.every((pid) => currentPerms.has(pid));
                    return (
                      <tr key={mod} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900 capitalize">{mod}</span>
                        </td>
                        {ACTIONS.map((action) => {
                          const pid = permLookup[`${mod}:${action}`];
                          const checked = isSuperAdmin || (pid ? currentPerms.has(pid) : false);
                          return (
                            <td key={action} className="text-center px-4 py-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(mod, action)}
                                disabled={isSuperAdmin}
                                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </td>
                          );
                        })}
                        <td className="text-center px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={() => toggleAllForModule(mod)}
                            disabled={isSuperAdmin}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
