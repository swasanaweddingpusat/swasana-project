"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
  Widget,
  Case,
  Bill,
  ShopMinimalistic,
  Dollar,
  ChartSquare,
  Buildings2,
  Heart,
  Sledgehammer,
  Notebook,
  AddCircle,
  PenNewSquare,
  TrashBinTrash,
  Refresh,
  AltArrowUp,
  AltArrowDown,
  DangerTriangle,
  CheckCircle,
} from "@solar-icons/react";
import {
  useModuleAdmin,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useReorderModuleRegistry,
} from "@/hooks/useModuleAdmin";
import type { ModuleAdminItem } from "@/lib/queries/modules";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Curated Solar icon set for modules — the string name is what's stored in
// Module.icon and re-resolved by the sidebar module-switcher.
const ICON_OPTIONS = [
  "Wallet", "UsersGroupRounded", "TicketSale", "CartLarge", "Case", "Bill",
  "ShopMinimalistic", "Dollar", "ChartSquare", "Buildings2", "Heart",
  "Sledgehammer", "Notebook", "Widget",
] as const;

const ICONS: Record<string, typeof Widget> = {
  Wallet, UsersGroupRounded, TicketSale, CartLarge, Case, Bill,
  ShopMinimalistic, Dollar, ChartSquare, Buildings2, Heart,
  Sledgehammer, Notebook, Widget,
};

function iconOf(name: string | null): typeof Widget {
  return ICONS[name ?? ""] ?? Widget;
}

interface FormState {
  key: string;
  name: string;
  icon: string;
  isActive: boolean;
  permissionModules: string[];
}

const EMPTY_FORM: FormState = {
  key: "",
  name: "",
  icon: "Widget",
  isActive: true,
  permissionModules: [],
};

interface ModulesManagerProps {
  initialModules: ModuleAdminItem[];
  permissionModules: string[];
}

export function ModulesManager({ initialModules, permissionModules }: ModulesManagerProps) {
  const { data: modules } = useModuleAdmin(initialModules);
  const ordered = [...(modules ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const createMut = useCreateModule();
  const updateMut = useUpdateModule();
  const deleteMut = useDeleteModule();
  const reorderMut = useReorderModuleRegistry();

  // Dialog state — `editing` null + open => create mode; editing set => edit mode.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleAdminItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<ModuleAdminItem | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: ModuleAdminItem) => {
    setEditing(m);
    setForm({
      key: m.key,
      name: m.name,
      icon: m.icon ?? "Widget",
      isActive: m.isActive,
      permissionModules: m.permissionModules,
    });
    setDialogOpen(true);
  };

  const togglePermModule = (pm: string) => {
    setForm((prev) => ({
      ...prev,
      permissionModules: prev.permissionModules.includes(pm)
        ? prev.permissionModules.filter((x) => x !== pm)
        : [...prev.permissionModules, pm],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    if (editing) {
      const res = await updateMut.mutateAsync({
        id: editing.id,
        name: form.name.trim(),
        icon: form.icon,
        isActive: form.isActive,
        permissionModules: form.permissionModules,
      });
      if (res.success) {
        toast.success("Module diperbarui");
        setDialogOpen(false);
      } else toast.error(res.error);
      return;
    }

    if (!form.key.trim()) return;
    const res = await createMut.mutateAsync({
      key: form.key.trim().toLowerCase(),
      name: form.name.trim(),
      icon: form.icon,
      isActive: form.isActive,
      permissionModules: form.permissionModules,
    });
    if (res.success) {
      toast.success("Module dibuat");
      setDialogOpen(false);
    } else toast.error(res.error);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await deleteMut.mutateAsync(deleting.id);
    if (res.success) {
      toast.success("Module dihapus");
      setDeleting(null);
    } else toast.error(res.error);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await reorderMut.mutateAsync(next.map((m) => m.id));
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className={cn("px-4", "pb-6", "sm:px-6", "space-y-5")}>
      {/* ── Warning banner: new modules need a physical route folder ── */}
      <div className={cn("flex", "items-start", "gap-3", "rounded-2xl", "border", "border-border", "bg-muted/40", "p-4")}>
        <DangerTriangle weight="BoldDuotone" className={cn("size-5", "shrink-0", "text-foreground/70", "mt-0.5")} />
        <div className="space-y-0.5">
          <p className={cn("text-sm", "font-medium", "text-foreground")}>Module baru butuh folder route</p>
          <p className={cn("text-xs", "text-muted-foreground", "leading-relaxed")}>
            Membuat module di sini hanya menambah entri di database — module akan muncul di switcher &
            picker login. Agar tidak <span className="font-medium">404</span> saat diklik, folder route{" "}
            <code className={cn("rounded", "bg-muted", "px-1", "py-0.5", "font-mono", "text-[11px]")}>app/(private)/&lt;key&gt;/</code>{" "}
            beserta halaman <code className={cn("rounded", "bg-muted", "px-1", "py-0.5", "font-mono", "text-[11px]")}>overview</code> harus dibuat developer terlebih dahulu.
          </p>
        </div>
      </div>

      {/* ── Header ── */}
      <div className={cn("flex", "items-center", "justify-between")}>
        <div>
          <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Module Registry</h2>
          <p className={cn("text-sm", "text-muted-foreground")}>
            Kelola module grup sidebar (Finance, HRD, Booking, dll) dan pemetaan permission-nya.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className={cn("gap-1", "rounded-full")}>
          <AddCircle weight="BoldDuotone" className="size-4" /> Tambah Module
        </Button>
      </div>

      {/* ── Module list ── */}
      <div className="space-y-3">
        {ordered.length === 0 && (
          <p className={cn("text-sm", "text-muted-foreground", "py-8", "text-center")}>Belum ada module.</p>
        )}
        {ordered.map((m, idx) => {
          const Icon = iconOf(m.icon);
          return (
            <div
              key={m.id}
              className={cn(
                "flex", "items-center", "gap-4", "rounded-2xl", "border", "border-border", "bg-card",
                "p-4", "shadow-sm", "transition-shadow", "hover:shadow-md",
              )}
            >
              {/* Reorder */}
              <div className={cn("flex", "flex-col", "shrink-0")}>
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || reorderMut.isPending}
                  className={cn("p-0.5", "rounded", "hover:bg-accent", "disabled:opacity-30", "disabled:pointer-events-none", "cursor-pointer")}
                  aria-label="Naik"
                >
                  <AltArrowUp weight="BoldDuotone" className={cn("size-4", "text-muted-foreground")} />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === ordered.length - 1 || reorderMut.isPending}
                  className={cn("p-0.5", "rounded", "hover:bg-accent", "disabled:opacity-30", "disabled:pointer-events-none", "cursor-pointer")}
                  aria-label="Turun"
                >
                  <AltArrowDown weight="BoldDuotone" className={cn("size-4", "text-muted-foreground")} />
                </button>
              </div>

              {/* Icon */}
              <span className={cn("flex", "size-11", "shrink-0", "items-center", "justify-center", "rounded-xl", "bg-accent")}>
                <Icon weight="BoldDuotone" className={cn("size-6", "text-foreground")} />
              </span>

              {/* Info */}
              <div className={cn("min-w-0", "flex-1")}>
                <div className={cn("flex", "items-center", "gap-2", "flex-wrap")}>
                  <span className={cn("font-medium", "text-foreground")}>{m.name}</span>
                  <code className={cn("rounded", "bg-muted", "px-1.5", "py-0.5", "font-mono", "text-[11px]", "text-muted-foreground")}>/{m.key}</code>
                  {m.isActive ? (
                    <span className={cn("inline-flex", "items-center", "gap-1", "rounded-full", "bg-accent", "px-2", "py-0.5", "text-[10px]", "font-medium", "text-foreground/70")}>
                      <CheckCircle weight="BoldDuotone" className="size-3" /> Aktif
                    </span>
                  ) : (
                    <span className={cn("inline-flex", "items-center", "rounded-full", "bg-muted", "px-2", "py-0.5", "text-[10px]", "font-medium", "text-muted-foreground")}>
                      Nonaktif
                    </span>
                  )}
                </div>
                <p className={cn("mt-1", "text-xs", "text-muted-foreground", "truncate")}>
                  {m.permissionModules.length > 0
                    ? m.permissionModules.join(", ")
                    : "Belum ada permission ter-mapping"}
                </p>
              </div>

              {/* Actions */}
              <div className={cn("flex", "gap-1", "shrink-0")}>
                <button onClick={() => openEdit(m)} className={cn("p-2", "rounded-lg", "hover:bg-accent", "cursor-pointer")} aria-label="Edit">
                  <PenNewSquare weight="BoldDuotone" className={cn("size-4", "text-primary")} />
                </button>
                <button onClick={() => setDeleting(m)} className={cn("p-2", "rounded-lg", "hover:bg-destructive/10", "cursor-pointer")} aria-label="Hapus">
                  <TrashBinTrash weight="BoldDuotone" className={cn("size-4", "text-destructive/70")} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{editing ? "Edit Module" : "Tambah Module"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui nama, icon, status, dan pemetaan permission module."
              : "Buat module grup baru untuk sidebar & picker login."}
          </DialogDescription>

          <div className={cn("mt-3", "space-y-4", "max-h-[60vh]", "overflow-y-auto", "pr-1")}>
            {/* Key — create only (URL segment, immutable after create) */}
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="mod-key">Key (segment URL) *</Label>
                <Input
                  id="mod-key"
                  value={form.key}
                  onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                  placeholder="mis. marketing"
                  autoFocus
                />
                <p className={cn("text-[11px]", "text-muted-foreground")}>
                  Huruf kecil, angka, tanda hubung. URL jadi <code className="font-mono">/{form.key || "<key>"}/overview</code>.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="mod-name">Nama tampil *</Label>
              <Input
                id="mod-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="mis. Marketing"
              />
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className={cn("grid", "grid-cols-7", "gap-2")}>
                {ICON_OPTIONS.map((name) => {
                  const Icon = ICONS[name];
                  const selected = form.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icon: name }))}
                      aria-label={name}
                      className={cn(
                        "flex", "items-center", "justify-center", "rounded-xl", "border", "p-2", "cursor-pointer", "transition-colors",
                        selected ? "border-primary bg-accent" : "border-border hover:bg-accent",
                      )}
                    >
                      <Icon weight="BoldDuotone" className={cn("size-5", selected ? "text-primary" : "text-foreground/70")} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active toggle */}
            <div className={cn("flex", "items-center", "justify-between", "rounded-xl", "border", "border-border", "p-3")}>
              <div>
                <p className={cn("text-sm", "font-medium", "text-foreground")}>Aktif</p>
                <p className={cn("text-xs", "text-muted-foreground")}>Module nonaktif tidak muncul di switcher.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
            </div>

            {/* Permission-module mapping */}
            <div className="space-y-1.5">
              <Label>Permission ter-mapping</Label>
              <p className={cn("text-[11px]", "text-muted-foreground")}>
                Module muncul untuk sebuah role jika role punya <code className="font-mono">view</code> pada salah satu permission ini.
              </p>
              <div className={cn("grid", "grid-cols-2", "gap-x-4", "gap-y-1.5", "rounded-xl", "border", "border-border", "p-3", "max-h-52", "overflow-y-auto")}>
                {permissionModules.length === 0 && (
                  <p className={cn("text-xs", "text-muted-foreground", "col-span-2")}>Tidak ada permission-module.</p>
                )}
                {permissionModules.map((pm) => (
                  <label key={pm} className={cn("flex", "items-center", "gap-2", "cursor-pointer", "text-sm")}>
                    <input
                      type="checkbox"
                      checked={form.permissionModules.includes(pm)}
                      onChange={() => togglePermModule(pm)}
                      className={cn("size-4", "rounded", "border-border", "accent-[var(--brand-ink)]", "cursor-pointer")}
                    />
                    <span className={cn("truncate", "text-foreground/80")}>{pm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSaving || !form.name.trim() || (!editing && !form.key.trim())}
            >
              {isSaving && <Refresh weight="BoldDuotone" className={cn("size-4", "animate-spin", "mr-1")} />}
              {editing ? "Simpan" : "Buat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Hapus Module</DialogTitle>
          <p className={cn("text-sm", "text-muted-foreground")}>
            Hapus module <strong>{deleting?.name}</strong> (<code className="font-mono">/{deleting?.key}</code>)?
            Pemetaan permission-nya ikut terhapus. Folder route (jika ada) tidak terpengaruh.
          </p>
          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Refresh weight="BoldDuotone" className={cn("size-4", "animate-spin", "mr-1")} />}
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
