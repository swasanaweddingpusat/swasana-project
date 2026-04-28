"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, GripVertical, PenLine, Save, Shield } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useApprovalFlows, useUpsertApprovalFlow, useDeleteApprovalFlow } from "@/hooks/use-approval-flows";
import { useRoles } from "@/hooks/use-roles";
import { useUsers } from "@/hooks/use-users";
import type { ApprovalFlowItem, ApprovalFlowsResult } from "@/lib/queries/approval-flows";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { UsersQueryResult } from "@/lib/queries/users";

interface LocalStep {
  tempId: string;
  approverType: "role" | "user";
  approverRoleId: string | null;
  approverUserId: string | null;
}

function SortableStep({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 p-3 border rounded-lg bg-white", isDragging && "opacity-50 shadow-lg")}>
      <button type="button" {...attributes} {...listeners} className={cn('text-gray-400', 'hover:text-gray-600', 'cursor-grab', 'active:cursor-grabbing', 'shrink-0')} tabIndex={-1}>
        <GripVertical className={cn('h-4', 'w-4')} />
      </button>
      <div className={cn('flex-1', 'min-w-0')}>{children}</div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'pb-4', 'border-b')}>
          <Skeleton className={cn('h-5', 'w-40')} />
          <Skeleton className={cn('h-9', 'w-28')} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {["#", "Module", "Nama", "Steps", "Status", "Actions"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className={cn('h-4', 'w-full')} /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ApprovalFlowManager() {
  const { data, isLoading } = useApprovalFlows();
  const flows: ApprovalFlowsResult = data ?? [];
  const rolesQuery = useRoles();
  const rolesData: RolesQueryResult = rolesQuery.data ?? [];
  const { data: usersData } = useUsers();
  const users: UsersQueryResult["users"] = usersData?.users ?? [];
  const upsertMut = useUpsertApprovalFlow();
  const deleteMut = useDeleteApprovalFlow();

  const [editingFlow, setEditingFlow] = useState<ApprovalFlowItem | null>(null);
  const [formModule, setFormModule] = useState("");
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formSteps, setFormSteps] = useState<LocalStep[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApprovalFlowItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function openAdd() {
    setEditingFlow(null);
    setFormModule("");
    setFormName("");
    setFormActive(true);
    setFormSteps([]);
    setFormOpen(true);
  }

  function openEdit(flow: ApprovalFlowItem) {
    setEditingFlow(flow);
    setFormModule(flow.module);
    setFormName(flow.name);
    setFormActive(flow.active);
    setFormSteps(flow.steps.map((s, i) => ({
      tempId: `step-${i}-${Date.now()}`,
      approverType: s.approverType as "role" | "user",
      approverRoleId: s.approverRoleId,
      approverUserId: s.approverUserId,
    })));
    setFormOpen(true);
  }

  function addStep() {
    setFormSteps((prev) => [...prev, { tempId: `step-${Date.now()}`, approverType: "role", approverRoleId: null, approverUserId: null }]);
  }

  function removeStep(tempId: string) {
    setFormSteps((prev) => prev.filter((s) => s.tempId !== tempId));
  }

  function updateStep(tempId: string, field: keyof LocalStep, value: string | null) {
    setFormSteps((prev) => prev.map((s) => {
      if (s.tempId !== tempId) return s;
      if (field === "approverType") return { ...s, approverType: value as "role" | "user", approverRoleId: null, approverUserId: null };
      return { ...s, [field]: value };
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFormSteps((prev) => {
      const oldIdx = prev.findIndex((s) => s.tempId === active.id);
      const newIdx = prev.findIndex((s) => s.tempId === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function handleSave() {
    if (!formModule.trim() || !formName.trim()) { toast.error("Module dan nama wajib diisi"); return; }
    if (formSteps.length === 0) { toast.error("Minimal satu step approval"); return; }
    const invalid = formSteps.some((s) => (s.approverType === "role" && !s.approverRoleId) || (s.approverType === "user" && !s.approverUserId));
    if (invalid) { toast.error("Semua step harus memiliki approver"); return; }

    const res = await upsertMut.mutateAsync({
      module: formModule.trim(),
      name: formName.trim(),
      active: formActive,
      steps: formSteps.map((s, i) => ({ sortOrder: i + 1, approverType: s.approverType, approverRoleId: s.approverRoleId, approverUserId: s.approverUserId })),
    });
    if (!res.success) { toast.error(res.error); return; }
    toast.success(editingFlow ? "Flow berhasil diupdate" : "Flow berhasil dibuat");
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await deleteMut.mutateAsync(deleteTarget.id);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Flow berhasil dihapus");
    setDeleteTarget(null);
  }

  function getStepsSummary(flow: ApprovalFlowItem) {
    return flow.steps.map((s) => {
      if (s.approverType === "role") return s.approverRole?.name ?? "—";
      return s.approverUser?.fullName ?? "—";
    }).join(" → ");
  }

  if (isLoading) return <SkeletonTable />;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'pb-4', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <h2 className={cn('text-base', 'font-bold', 'text-[#1D1D1D]')}>Approval Flows</h2>
              <span className={cn('text-sm', 'text-muted-foreground')}>({flows.length})</span>
            </div>
            <Button onClick={openAdd} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2', 'bg-gray-900', 'hover:bg-gray-800', 'text-white', 'rounded-md', 'px-4', 'py-2', 'text-sm', 'font-medium')}>
              <Plus className={cn('h-4', 'w-4')} /> Tambah Flow
            </Button>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Approval Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className={cn('text-center', 'py-8', 'text-muted-foreground')}>
                    <Shield className={cn('h-8', 'w-8', 'mx-auto', 'mb-2', 'text-muted-foreground/30')} />
                    Belum ada approval flow
                  </TableCell>
                </TableRow>
              ) : (
                flows.map((flow, idx) => (
                  <TableRow key={flow.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs', 'px-2', 'py-0.5', 'rounded-full', 'bg-muted', 'text-muted-foreground', 'font-mono')}>{flow.module}</span>
                    </TableCell>
                    <TableCell className="font-medium">{flow.name}</TableCell>
                    <TableCell>
                      <span className={cn('text-sm', 'text-muted-foreground')}>{getStepsSummary(flow)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        flow.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {flow.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={cn('flex', 'items-center', 'gap-1')}>
                        <button className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} onClick={() => openEdit(flow)} title="Edit">
                          <PenLine className={cn('h-4', 'w-4', 'text-muted-foreground')} />
                        </button>
                        <button className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} onClick={() => setDeleteTarget(flow)} title="Hapus">
                          <Trash2 className={cn('h-4', 'w-4', 'text-muted-foreground')} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      {formOpen && (
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/50')} onClick={() => setFormOpen(false)}>
          <div className={cn('bg-white', 'rounded-xl', 'shadow-xl', 'w-full', 'max-w-lg', 'mx-4', 'max-h-[85vh]', 'flex', 'flex-col')} onClick={(e) => e.stopPropagation()}>
            <div className={cn('px-5', 'py-4', 'border-b')}>
              <h2 className={cn('text-base', 'font-semibold')}>{editingFlow ? "Edit Approval Flow" : "Tambah Approval Flow"}</h2>
            </div>
            <div className={cn('flex-1', 'overflow-y-auto', 'px-5', 'py-4', 'space-y-4')}>
              <div className={cn('grid', 'grid-cols-2', 'gap-3')}>
                <div className="space-y-1.5">
                  <Label className="text-sm">Module</Label>
                  <Input value={formModule} onChange={(e) => setFormModule(e.target.value)} placeholder="package, booking..." disabled={!!editingFlow} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nama</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Approval Paket" className="text-sm" />
                </div>
              </div>
              <div className={cn('flex', 'items-center', 'justify-between')}>
                <Label className="text-sm">Aktif</Label>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>

              <div className="space-y-2">
                <Label className={cn('text-sm', 'font-semibold')}>Steps</Label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={formSteps.map((s) => s.tempId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {formSteps.map((step, i) => (
                        <SortableStep key={step.tempId} id={step.tempId}>
                          <div className={cn('flex', 'items-center', 'gap-2')}>
                            <span className={cn('flex', 'items-center', 'justify-center', 'h-5', 'w-5', 'rounded-full', 'bg-black', 'text-white', 'text-xs', 'font-bold', 'shrink-0')}>{i + 1}</span>
                            <select
                              value={step.approverType}
                              onChange={(e) => updateStep(step.tempId, "approverType", e.target.value)}
                              className={cn('h-8', 'rounded-md', 'border', 'border-gray-300', 'bg-white', 'px-2', 'text-sm', 'focus:outline-none', 'focus:ring-1', 'focus:ring-ring')}
                            >
                              <option value="role">Role</option>
                              <option value="user">User</option>
                            </select>
                            <div className="flex-1">
                              {step.approverType === "role" ? (
                                <SearchableSelect
                                  options={rolesData.map((r) => ({ id: r.id, name: r.name }))}
                                  value={step.approverRoleId ?? ""}
                                  onChange={(id) => updateStep(step.tempId, "approverRoleId", id)}
                                  placeholder="Pilih role..."
                                  searchPlaceholder="Cari role..."
                                />
                              ) : (
                                <SearchableSelect
                                  options={users.map((u) => ({ id: u.id, name: u.profile?.fullName ?? u.email ?? u.id }))}
                                  value={step.approverUserId ?? ""}
                                  onChange={(id) => updateStep(step.tempId, "approverUserId", id)}
                                  placeholder="Pilih user..."
                                  searchPlaceholder="Cari user..."
                                />
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeStep(step.tempId)} className={cn('h-8', 'w-8', 'p-0', 'shrink-0', 'text-red-500', 'hover:text-red-700', 'hover:bg-red-50')}>
                              <Trash2 className={cn('h-3.5', 'w-3.5')} />
                            </Button>
                          </div>
                        </SortableStep>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button variant="outline" size="sm" onClick={addStep} className={cn('w-full', 'border-dashed')}>
                  <Plus className={cn('h-3.5', 'w-3.5', 'mr-1')} />Tambah Step
                </Button>
              </div>
            </div>
            <div className={cn('px-5', 'py-3', 'border-t', 'flex', 'gap-2')}>
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={handleSave} disabled={upsertMut.isPending} className="flex-1">
                <Save className={cn('h-4', 'w-4', 'mr-1')} />{upsertMut.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Approval Flow?</AlertDialogTitle>
            <AlertDialogDescription>Flow &quot;{deleteTarget?.name}&quot; akan dihapus beserta semua step-nya. Aksi ini tidak bisa dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn('bg-red-600', 'hover:bg-red-700')}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
