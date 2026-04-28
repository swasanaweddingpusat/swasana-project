"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Building2, Globe, User, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { bulkUpdateUsers } from "@/actions/user";
import { useGroups } from "@/hooks/use-groups";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { BrandsQueryResult } from "@/lib/queries/venues";
import type { ManagerProfile } from "@/lib/queries/users";

type VenueScope = "general" | "individual";
type DataScope = "own" | "group" | "all";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedUserIds: string[];
  roles: RolesQueryResult;
  brands: BrandsQueryResult;
  onSuccess: () => void;
}

export function BulkEditModal({ open, onClose, selectedUserIds, roles, brands, onSuccess }: Props) {
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
  const [roleId, setRoleId] = useState("");
  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [venueScopes, setVenueScopes] = useState<Record<string, VenueScope>>({});
  const [venueManagers, setVenueManagers] = useState<Record<string, string>>({});
  const [dataScope, setDataScope] = useState<DataScope>("own");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setRoleId(""); setVenueIds([]); setVenueScopes({}); setVenueManagers({}); setDataScope("own");
    setSelectedGroupIds([]); setExpandedBrands(new Set());
    onClose();
  };

  const toggleVenue = (venueId: string, checked: boolean) => {
    if (checked) {
      setVenueIds((prev) => [...prev, venueId]);
      setVenueScopes((prev) => ({ ...prev, [venueId]: prev[venueId] ?? "individual" }));
    } else {
      setVenueIds((prev) => prev.filter((id) => id !== venueId));
      setVenueScopes((prev) => { const n = { ...prev }; delete n[venueId]; return n; });
      setVenueManagers((prev) => { const n = { ...prev }; delete n[venueId]; return n; });
    }
  };

  const selectAllForBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return;
    const ids = brand.venues.map((v) => v.id);
    const allSelected = ids.every((id) => venueIds.includes(id));
    if (allSelected) {
      setVenueIds((prev) => prev.filter((id) => !ids.includes(id)));
      setVenueScopes((prev) => { const n = { ...prev }; ids.forEach((id) => delete n[id]); return n; });
      setVenueManagers((prev) => { const n = { ...prev }; ids.forEach((id) => delete n[id]); return n; });
    } else {
      setVenueIds((prev) => [...new Set([...prev, ...ids])]);
      setVenueScopes((prev) => { const n = { ...prev }; ids.forEach((id) => { if (!n[id]) n[id] = "individual"; }); return n; });
    }
  };

  const allVenueIds = brands.flatMap((b) => b.venues.map((v) => v.id));
  const allVenuesSelected = allVenueIds.length > 0 && allVenueIds.every((id) => venueIds.includes(id));

  const toggleAllVenues = (checked: boolean) => {
    if (checked) {
      setVenueIds([...allVenueIds]);
      setVenueScopes(Object.fromEntries(allVenueIds.map((id) => [id, "individual" as VenueScope])));
      setExpandedBrands(new Set(brands.map((b) => b.id)));
    } else {
      setVenueIds([]); setVenueScopes({}); setVenueManagers({}); setExpandedBrands(new Set());
    }
  };

  const handleSubmit = async () => {
    if (!roleId && venueIds.length === 0 && dataScope === "own") { toast.error("Pilih minimal role, venue, atau data access"); return; }
    setSubmitting(true);
    const result = await bulkUpdateUsers({
      userIds: selectedUserIds,
      ...(roleId && { roleId }),
      ...(venueIds.length > 0 && { venueIds, venueScopes, venueManagers }),
      dataScope,
      ...(dataScope === "group" && selectedGroupIds.length > 0 && { groupIds: selectedGroupIds }),
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(`${result.updated} user berhasil diupdate`);
    onSuccess();
    handleClose();
  };

  return (
    <Drawer isOpen={open} onClose={handleClose} title={`Bulk Edit (${selectedUserIds.length} users)`}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="space-y-3 px-2">

            {/* Role */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]">
                  <SelectValue placeholder="Pilih role baru (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="capitalize">{r.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 mt-1">Kosongkan jika tidak ingin mengubah role</p>
            </div>

            {/* Data Access */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Data Access</Label>
              <p className="text-xs text-gray-500 mt-1 mb-2">Controls which booking data this user can see</p>
              <div className="flex gap-2">
                {(["own", "group", "all"] as const).map((scope) => {
                  const icons = { own: <User className="h-3 w-3" />, group: <Users className="h-3 w-3" />, all: <Globe className="h-3 w-3" /> };
                  const labels = { own: "Own", group: "Group", all: "All" };
                  const isActive = dataScope === scope;
                  return (
                    <button key={scope} type="button" onClick={() => setDataScope(scope)}
                      className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-all flex-1 justify-center",
                        isActive ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      )}>
                      {icons[scope]}{labels[scope]}
                    </button>
                  );
                })}
              </div>
              {dataScope === "group" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">Assign ke group:</p>
                  {selectedGroupIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedGroupIds.map((gid) => {
                        const g = groups.find((x) => x.id === gid);
                        if (!g) return null;
                        return (
                          <span key={gid} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-900 text-white rounded-full">
                            {g.name}
                            <button type="button" onClick={() => setSelectedGroupIds((prev) => prev.filter((id) => id !== gid))} className="ml-0.5 hover:text-gray-300"><X className="h-3 w-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <SearchableSelect
                    options={groups.filter((g) => !selectedGroupIds.includes(g.id)).map((g) => ({ id: g.id, name: g.name }))}
                    value={undefined}
                    onChange={(gid) => { if (gid && !selectedGroupIds.includes(gid)) setSelectedGroupIds((prev) => [...prev, gid]); }}
                    placeholder="Tambah ke group..."
                    searchPlaceholder="Cari group..."
                    emptyText="Tidak ada group"
                  />
                </div>
              )}
            </div>

            {/* Assigned Venues */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Assigned Venues</Label>
                {allVenueIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">All</span>
                    <Switch checked={allVenuesSelected} onCheckedChange={toggleAllVenues} className="scale-75" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 mb-2">Kosongkan jika tidak ingin mengubah venue</p>

              <div className="space-y-2">
                {brands.map((brand) => {
                  const isExpanded = expandedBrands.has(brand.id);
                  const brandVenues = brand.venues ?? [];
                  const selectedCount = brandVenues.filter((v) => venueIds.includes(v.id)).length;
                  const allSelectedForBrand = brandVenues.length > 0 && selectedCount === brandVenues.length;
                  return (
                    <div key={brand.id} className={cn("rounded-lg border transition-all duration-200", isExpanded ? "border-gray-300 bg-white shadow-sm" : "border-gray-200 bg-gray-50/50")}>
                      <button type="button" onClick={() => setExpandedBrands((prev) => { const n = new Set(prev); if (n.has(brand.id)) { n.delete(brand.id); } else { n.add(brand.id); } return n; })} className="flex items-center w-full px-3 py-2.5 gap-2.5">
                        <Building2 className={cn("h-4 w-4 shrink-0 transition-colors", isExpanded ? "text-gray-900" : "text-gray-400")} />
                        <span className={cn("text-sm flex-1 text-left transition-colors", isExpanded ? "font-semibold text-gray-900" : "font-medium text-gray-600")}>{brand.name}</span>
                        {selectedCount > 0 && <span className="text-[10px] font-medium bg-black text-white rounded-full px-1.5 py-0.5 min-w-5 text-center">{selectedCount}</span>}
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3">
                          {brandVenues.length > 0 && (
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                              <span className="text-[11px] text-gray-400 uppercase tracking-wider">{brandVenues.length} venue{brandVenues.length > 1 ? "s" : ""}</span>
                              <button type="button" onClick={() => selectAllForBrand(brand.id)} className="text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors">
                                {allSelectedForBrand ? "Deselect all" : "Select all"}
                              </button>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {brandVenues.map((venue) => {
                              const isSelected = venueIds.includes(venue.id);
                              return (
                                <div key={venue.id} className="space-y-1.5">
                                  <div className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-all duration-150 cursor-pointer", isSelected ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100")} onClick={() => toggleVenue(venue.id, !isSelected)}>
                                    <Checkbox checked={isSelected} onCheckedChange={(c) => toggleVenue(venue.id, c as boolean)} onClick={(e) => e.stopPropagation()} className={cn("shrink-0 border-gray-300", isSelected && "border-white data-[state=checked]:bg-white data-[state=checked]:text-gray-900")} />
                                    <span className="text-xs font-medium flex-1 truncate">{venue.name}</span>
                                  </div>
                                  {isSelected && managers.length > 0 && (
                                    <div className="pl-7 pr-1">
                                      <SearchableSelect
                                        options={[{ id: "", name: "Tanpa manager" }, ...managers.map((m) => ({ id: m.id, name: m.fullName ?? "" }))]}
                                        value={venueManagers[venue.id] ?? ""}
                                        onChange={(v) =>
                                          setVenueManagers((prev) =>
                                            v ? { ...prev, [venue.id]: v } : (() => { const n = { ...prev }; delete n[venue.id]; return n; })()
                                          )
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white pt-4 px-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting} className="flex-1 cursor-pointer text-red-600 border-red-600 hover:bg-red-50">Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer">{submitting ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
