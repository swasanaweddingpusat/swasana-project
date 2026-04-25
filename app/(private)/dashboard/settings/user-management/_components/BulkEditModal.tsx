"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Building2, Globe, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { updateUser } from "@/actions/user";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { BrandsQueryResult } from "@/lib/queries/venues";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedUserIds: string[];
  roles: RolesQueryResult;
  brands: BrandsQueryResult;
  onSuccess: () => void;
}

export function BulkEditModal({ open, onClose, selectedUserIds, roles, brands, onSuccess }: Props) {
  const [roleId, setRoleId] = useState("");
  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [venueScopes, setVenueScopes] = useState<Record<string, "general" | "individual">>({});
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => { setRoleId(""); setVenueIds([]); setVenueScopes({}); setExpandedBrands(new Set()); onClose(); };

  const handleVenueChange = (venueId: string, checked: boolean) => {
    if (checked) {
      setVenueIds((prev) => [...prev, venueId]);
      setVenueScopes((prev) => ({ ...prev, [venueId]: prev[venueId] ?? "individual" }));
    } else {
      setVenueIds((prev) => prev.filter((id) => id !== venueId));
      setVenueScopes((prev) => { const n = { ...prev }; delete n[venueId]; return n; });
    }
  };

  const handleSelectAllBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return;
    const ids = brand.venues.map((v) => v.id);
    const allSelected = ids.every((id) => venueIds.includes(id));
    if (allSelected) {
      setVenueIds((prev) => prev.filter((id) => !ids.includes(id)));
      setVenueScopes((prev) => { const n = { ...prev }; ids.forEach((id) => delete n[id]); return n; });
    } else {
      setVenueIds((prev) => [...new Set([...prev, ...ids])]);
      setVenueScopes((prev) => { const n = { ...prev }; ids.forEach((id) => { if (!n[id]) n[id] = "individual"; }); return n; });
    }
  };

  const allVenueIds = brands.flatMap((b) => b.venues.map((v) => v.id));
  const allSelected = allVenueIds.length > 0 && allVenueIds.every((id) => venueIds.includes(id));

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setVenueIds([...allVenueIds]);
      setVenueScopes(Object.fromEntries(allVenueIds.map((id) => [id, "individual" as const])));
      setExpandedBrands(new Set(brands.map((b) => b.id)));
    } else {
      setVenueIds([]); setVenueScopes({}); setExpandedBrands(new Set());
    }
  };

  const handleSubmit = async () => {
    if (!roleId && venueIds.length === 0) { toast.error("Pilih minimal role atau venue"); return; }
    setSubmitting(true);
    const results = await Promise.allSettled(
      selectedUserIds.map((userId) =>
        updateUser({ userId, ...(roleId && { roleId }), ...(venueIds.length > 0 && { venueIds, venueScopes }) })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (failed > 0) toast.error(`${failed} user gagal diupdate`);
    if (succeeded > 0) toast.success(`${succeeded} user berhasil diupdate`);
    setSubmitting(false);
    onSuccess();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogTitle className="sr-only">Bulk Edit Users</DialogTitle>
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">Bulk Edit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedUserIds.length} user dipilih</p>
          </div>
          <button type="button" onClick={handleClose} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Role */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Role</Label>
            <SearchableSelect
              options={roles.map((r) => ({ id: r.id, name: r.name }))}
              value={roleId}
              onChange={setRoleId}
              placeholder="Pilih role baru (opsional)"
              searchPlaceholder="Cari role..."
              emptyText="Tidak ada role"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Kosongkan jika tidak ingin mengubah role</p>
          </div>

          {/* Venue Access */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium">Venue Access</Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">All</span>
                <Switch checked={allSelected} onCheckedChange={handleToggleAll} className="scale-75" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">Kosongkan jika tidak ingin mengubah venue</p>

            {venueIds.length > 0 && (
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setVenueScopes(Object.fromEntries(venueIds.map((id) => [id, "individual" as const])))} className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border bg-secondary text-secondary-foreground hover:bg-accent">
                  <User className="h-3 w-3" /> Set All Own
                </button>
                <button type="button" onClick={() => setVenueScopes(Object.fromEntries(venueIds.map((id) => [id, "general" as const])))} className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border bg-secondary text-secondary-foreground hover:bg-accent">
                  <Globe className="h-3 w-3" /> Set All
                </button>
              </div>
            )}

            <div className="space-y-2">
              {brands.map((brand) => {
                const isExpanded = expandedBrands.has(brand.id);
                const selectedCount = brand.venues.filter((v) => venueIds.includes(v.id)).length;
                const allBrandSelected = brand.venues.length > 0 && selectedCount === brand.venues.length;
                return (
                  <div key={brand.id} className={cn("rounded-lg border transition-all", isExpanded ? "border-border bg-card" : "border-border bg-muted/30")}>
                    <button type="button" onClick={() => setExpandedBrands((prev) => { const n = new Set(prev); if (n.has(brand.id)) { n.delete(brand.id); } else { n.add(brand.id); } return n; })} className="flex items-center w-full px-3 py-2.5 gap-2.5">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium flex-1 text-left">{brand.name}</span>
                      {selectedCount > 0 && <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">{selectedCount}</span>}
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b">
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{brand.venues.length} venue</span>
                          <button type="button" onClick={() => handleSelectAllBrand(brand.id)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                            {allBrandSelected ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {brand.venues.map((venue) => {
                            const isSelected = venueIds.includes(venue.id);
                            const scope = venueScopes[venue.id] ?? "individual";
                            return (
                              <div key={venue.id} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted")} onClick={() => handleVenueChange(venue.id, !isSelected)}>
                                <Checkbox checked={isSelected} onCheckedChange={(c) => handleVenueChange(venue.id, c as boolean)} onClick={(e) => e.stopPropagation()} />
                                <span className="text-xs font-medium flex-1 truncate">{venue.name}</span>
                                {isSelected && (
                                  <div className="flex items-center bg-primary-foreground/20 rounded overflow-hidden shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => setVenueScopes((prev) => ({ ...prev, [venue.id]: "individual" }))} className={cn("flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors", scope === "individual" ? "bg-background text-foreground" : "text-primary-foreground/60 hover:text-primary-foreground/80")}>
                                      <User className="h-3 w-3" /> Own
                                    </button>
                                    <button type="button" onClick={() => setVenueScopes((prev) => ({ ...prev, [venue.id]: "general" }))} className={cn("flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors", scope === "general" ? "bg-background text-foreground" : "text-primary-foreground/60 hover:text-primary-foreground/80")}>
                                      <Globe className="h-3 w-3" /> All
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3">
          <Button variant="outline" onClick={handleClose} disabled={submitting} className="flex-1">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1">{submitting ? "Menyimpan..." : "Simpan"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
