"use client";

import { useState } from "react";
import { Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GroupSalesListItem, type SalesListMember } from "./GroupSalesListItem";
import { GroupSalesDetailPanel } from "./GroupSalesDetailPanel";

interface Props {
  members: SalesListMember[];
  canManage: boolean;
  onAddMember: () => void;
  onEditTarget: (member: SalesListMember) => void;
  onRemoveMember: (member: SalesListMember) => void;
  onViewAllBookings: (member: SalesListMember) => void;
}

export function GroupSalesMasterDetail({
  members,
  canManage,
  onAddMember,
  onEditTarget,
  onRemoveMember,
  onViewAllBookings,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // mobile: "list" | "detail"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Derive effective selected ID — fall back to first member if current selection no longer exists
  const effectiveSelectedId =
    members.length === 0
      ? null
      : members.some((m) => m.profileId === selectedId)
        ? selectedId
        : (members[0]?.profileId ?? null);

  const selectedMember = members.find((m) => m.profileId === effectiveSelectedId) ?? null;

  function handleSelectMember(profileId: string) {
    setSelectedId(profileId);
    setMobileView("detail");
  }

  function handleBackToList() {
    setMobileView("list");
  }

  return (
    <>
      {/* ── Desktop: side-by-side ── */}
      <div className="hidden md:flex border border-border rounded-lg overflow-hidden bg-background min-h-96">
        {/* Left master pane */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold text-foreground">
              Sales ({members.length})
            </span>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={onAddMember}
              >
                <Plus className="h-3 w-3" /> Tambah
              </Button>
            )}
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5" role="list" aria-label="Daftar sales">
              {members.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground" role="status">
                  Belum ada anggota
                </p>
              ) : (
                members.map((member) => (
                  <GroupSalesListItem
                    key={member.profileId}
                    member={member}
                    isSelected={effectiveSelectedId === member.profileId}
                    canManage={canManage}
                    onSelect={handleSelectMember}
                    onEditTarget={onEditTarget}
                    onRemove={onRemoveMember}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right detail pane */}
        <div className="flex-1 overflow-y-auto">
          <GroupSalesDetailPanel
            member={selectedMember}
            hasMembers={members.length > 0}
            onViewAllBookings={onViewAllBookings}
          />
        </div>
      </div>

      {/* ── Mobile: stacked with swap ── */}
      <div className="md:hidden border border-border rounded-lg overflow-hidden bg-background">
        {mobileView === "list" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                Sales ({members.length})
              </span>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 min-w-11 gap-1 text-sm px-3"
                  onClick={onAddMember}
                >
                  <Plus className="h-4 w-4" /> Tambah
                </Button>
              )}
            </div>

            {/* List */}
            <div className="p-2 space-y-0.5" role="list" aria-label="Daftar sales">
              {members.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground" role="status">
                  Belum ada anggota
                </p>
              ) : (
                members.map((member) => (
                  <GroupSalesListItem
                    key={member.profileId}
                    member={member}
                    isSelected={false}
                    canManage={canManage}
                    onSelect={handleSelectMember}
                    onEditTarget={onEditTarget}
                    onRemove={onRemoveMember}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Back button */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
              <Button
                variant="ghost"
                className="h-11 gap-1.5 text-sm px-2"
                onClick={handleBackToList}
                aria-label="Kembali ke daftar sales"
              >
                <ChevronLeft className="h-4 w-4" /> Kembali
              </Button>
            </div>

            {/* Detail */}
            <GroupSalesDetailPanel
              member={selectedMember}
              hasMembers={members.length > 0}
              onViewAllBookings={(m) => {
                onViewAllBookings(m);
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
