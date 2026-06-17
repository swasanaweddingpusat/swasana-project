"use client";

import React, { useState } from "react";
import { AddCircle, AltArrowLeft, UsersGroupRounded } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { GroupSalesListItem, type SalesListMember } from "./GroupSalesListItem";
import { SalesBookingsPanel } from "./SalesBookingsPanel";

interface Props {
  members: SalesListMember[];
  canManage: boolean;
  selectedSalesId: string | null;
  onSelectSales: (profileId: string) => void;
  onAddMember: () => void;
  onEditTarget: (member: SalesListMember) => void;
  onRemoveMember: (member: SalesListMember) => void;
}

export function GroupSalesMasterDetail({
  members,
  canManage,
  selectedSalesId,
  onSelectSales,
  onAddMember,
  onEditTarget,
  onRemoveMember,
}: Props): React.JSX.Element {
  // mobile: "list" | "detail"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const selectedMember = members.find((m) => m.profileId === selectedSalesId) ?? null;

  function handleSelectMember(profileId: string): void {
    onSelectSales(profileId);
    setMobileView("detail");
  }

  function handleBackToList(): void {
    setMobileView("list");
  }

  // ── Shared panel content ────────────────────────────────────────────────────

  function renderDetailPanel(): React.JSX.Element {
    if (!selectedMember) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full py-20 text-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-secondary">
            <UsersGroupRounded weight="BoldDuotone" className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Pilih sales</p>
            <p className="text-xs text-muted-foreground">
              Pilih sales dari daftar kiri untuk melihat booking-nya
            </p>
          </div>
        </div>
      );
    }

    return (
      <SalesBookingsPanel
        salesId={selectedMember.profileId}
        salesName={selectedMember.name}
        avatarUrl={selectedMember.avatarUrl}
        metrics={{
          actual: selectedMember.actual,
          target: selectedMember.target,
          pendingApproval: selectedMember.pendingApproval,
          rank: selectedMember.rank,
        }}
      />
    );
  }

  // ── Shared list content ─────────────────────────────────────────────────────

  function renderList(showSelected: boolean): React.JSX.Element {
    return (
      <>
        {members.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground" role="status">
            Belum ada anggota
          </p>
        ) : (
          members.map((member) => (
            <GroupSalesListItem
              key={member.profileId}
              member={member}
              isSelected={showSelected && selectedSalesId === member.profileId}
              canManage={canManage}
              onSelect={handleSelectMember}
              onEditTarget={onEditTarget}
              onRemove={onRemoveMember}
            />
          ))
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Desktop: side-by-side ── */}
      <div className="hidden md:flex border border-border rounded-3xl overflow-hidden bg-card shadow-sm min-h-96">
        {/* Left master pane */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-secondary/20">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-foreground">Sales</span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">{members.length}</span>
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs rounded-full"
                onClick={onAddMember}
              >
                <AddCircle weight="BoldDuotone" className="h-3 w-3" /> Tambah
              </Button>
            )}
          </div>

          {/* Scrollable list */}
          <div
            className="overflow-y-auto flex-1 min-h-0"
            style={{ maxHeight: "calc(100vh - 20rem)" }}
          >
            <div className="p-2 space-y-0.5" role="list" aria-label="Daftar sales">
              {renderList(true)}
            </div>
          </div>
        </div>

        {/* Right detail pane */}
        <div className="flex-1 overflow-y-auto">
          {renderDetailPanel()}
        </div>
      </div>

      {/* ── Mobile: stacked with swap ── */}
      <div className="md:hidden border border-border rounded-3xl overflow-hidden bg-card shadow-sm">
        {mobileView === "list" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-foreground">Sales</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{members.length}</span>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 min-w-11 gap-1 text-sm px-3"
                  onClick={onAddMember}
                >
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" /> Tambah
                </Button>
              )}
            </div>

            {/* List */}
            <div className="p-2 space-y-0.5" role="list" aria-label="Daftar sales">
              {renderList(false)}
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
                <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" /> Kembali
              </Button>
            </div>

            {/* Detail */}
            {renderDetailPanel()}
          </>
        )}
      </div>
    </>
  );
}
