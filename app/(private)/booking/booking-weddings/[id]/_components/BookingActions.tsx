"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChatRound, ClipboardCheck, CheckCircle, ClockCircle, CloseCircle, AltArrowDown,
} from "@solar-icons/react";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { fetchBookingComments } from "@/services/booking-comment-service";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { BookingCommentPanel } from "@/app/(private)/booking/booking-weddings/_components/booking-comment-panel";
import { ApprovalDialog } from "@/app/(private)/booking/packages/_components/approval-dialog";
import { ApproveModal } from "@/app/(private)/booking/packages/_components/approve-modal";

/* ─── Approval record shape (subset — mirrors /api/approval-records) ─────────── */

interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
  revisionId: string | null;
  status: string;
  approverRole: { id: string; name: string } | null;
  approverUser: { id: string; fullName: string | null } | null;
}

interface ApprovalRecord {
  id: string;
  status: string;
  steps: ApprovalStep[];
}

interface Props {
  bookingId: string;
  customerName: string;
  currentRevisionId: string | null;
  bookingStatus: string;
}

/**
 * Toolbar controls for the standalone booking detail page: live discussion
 * (reuses BookingCommentPanel) + approval (reuses ApprovalDialog + ApproveModal).
 * All state lives here so the page component stays presentational. Approval
 * state is fetched from the same endpoint ApprovalDialog uses and the actionable
 * logic mirrors bookings-table (revision-aware, client steps dropped).
 */
export function BookingActions({ bookingId, customerName, currentRevisionId, bookingStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions();

  const [chatOpen, setChatOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<{ stepId: string; stepLabel: string } | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const deepLinkFiredRef = useRef(false);

  // Deep-link dari notifikasi mention: ?openComments=true&highlightComment=Y.
  // bookingId sudah pasti = halaman ini, jadi cukup buka panel + highlight,
  // lalu bersihkan query biar refresh/back gak buka ulang (mirror bookings-table).
  useEffect(() => {
    if (deepLinkFiredRef.current) return;
    if (searchParams.get("openComments") !== "true") return;
    deepLinkFiredRef.current = true;
    const highlight = searchParams.get("highlightComment");
    setChatOpen(true);
    if (highlight) setHighlightCommentId(highlight);
    const url = new URL(window.location.href);
    url.searchParams.delete("openComments");
    url.searchParams.delete("highlightComment");
    url.searchParams.delete("bookingId");
    const cleanSearch = url.search === "?" ? "" : url.search;
    router.replace(url.pathname + cleanSearch, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: counts } = useUnreadCommentCounts([bookingId]);
  const unread = counts?.unreadCounts?.[bookingId] ?? 0;
  const mentions = counts?.mentionCounts?.[bookingId] ?? 0;

  const { data: approval } = useQuery({
    queryKey: ["approval-records", "booking", bookingId],
    queryFn: async (): Promise<ApprovalRecord | null> => {
      const res = await fetch(`/api/approval-records?module=booking&entityId=${bookingId}`);
      if (!res.ok) return null;
      return (await res.json()) as ApprovalRecord | null;
    },
    staleTime: 15_000,
  });

  // Approval state — revision-aware, drop client steps (mirrors bookings-table).
  const allSteps = approval?.steps ?? [];
  const hasRevisioned = allSteps.some((s) => s.revisionId !== null);
  const roundSteps = currentRevisionId && hasRevisioned
    ? allSteps.filter((s) => s.revisionId === currentRevisionId)
    : allSteps;
  const nonClientSteps = roundSteps.filter((s) => s.approverType !== "client");
  const hasRecord = !!approval && nonClientSteps.length > 0;
  const allApproved = hasRecord && nonClientSteps.every((s) => s.status === "approved");
  const anyRejected = nonClientSteps.some((s) => s.status === "rejected");
  // Canceled bookings expose no approval control (mirrors bookings-table, which
  // hides the approval trigger when bookingStatus === "Canceled").
  const isCanceled = bookingStatus === "Canceled";

  const stepLabel = (s: ApprovalStep): string =>
    (s.approverType === "role" ? s.approverRole?.name : s.approverUser?.fullName) ?? "Approver";

  const canActOn = (s: ApprovalStep): boolean =>
    s.status === "pending" && (
      isAdmin ||
      (s.approverType === "role" && s.approverRoleId === user?.roleId) ||
      (s.approverType === "user" && s.approverUserId === user?.profileId)
    );

  const chip = anyRejected
    ? { label: "Approval ditolak", dot: "bg-destructive", cls: "border-destructive/30 text-destructive" }
    : allApproved
      ? { label: "Approved", dot: "bg-primary", cls: "border-primary/20 text-primary" }
      : hasRecord
        ? { label: "Menunggu approval", dot: "bg-muted-foreground/60", cls: "border-border text-muted-foreground" }
        : { label: "Approval", dot: "bg-muted-foreground/40", cls: "border-border text-muted-foreground" };

  const pillBase =
    "relative inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Discussion ─────────────────────────────────────────────────────── */}
      <PermissionGate module="booking" action="comment">
        <button
          type="button"
          onMouseEnter={() =>
            qc.prefetchQuery({
              queryKey: ["booking-comments", bookingId],
              queryFn: () => fetchBookingComments(bookingId),
            })
          }
          onClick={() => setChatOpen(true)}
          className={`${pillBase} text-foreground hover:border-primary/30`}
        >
          <ChatRound weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          Diskusi
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          {mentions > 0 && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ backgroundColor: "var(--brand-gold)", color: "var(--brand-ink)" }}
            >
              @
            </span>
          )}
        </button>
      </PermissionGate>

      {/* ── Approval (hidden for canceled bookings — mirrors bookings-table) ── */}
      {!isCanceled && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`${pillBase} ${chip.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
            {chip.label}
            <AltArrowDown weight="BoldDuotone" className="h-3.5 w-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Approval</DropdownMenuLabel>
          {hasRecord ? (
            nonClientSteps.map((s) => {
              const approved = s.status === "approved";
              const rejected = s.status === "rejected";
              const actionable = canActOn(s);
              return (
                <DropdownMenuItem
                  key={s.id}
                  className="cursor-pointer gap-2"
                  disabled={!actionable}
                  onClick={() => {
                    if (actionable) setApproveTarget({ stepId: s.id, stepLabel: stepLabel(s) });
                  }}
                >
                  {approved ? (
                    <CheckCircle weight="BoldDuotone" className="h-4 w-4 text-primary" />
                  ) : rejected ? (
                    <CloseCircle weight="BoldDuotone" className="h-4 w-4 text-destructive" />
                  ) : (
                    <ClockCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">
                    {actionable ? `Approve ${stepLabel(s)}` : stepLabel(s)}
                  </span>
                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Belum ada alur approval.</div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setDialogOpen(true)}>
            <ClipboardCheck weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            Lihat progres approval
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      {/* ── Discussion panel (right sheet, reused from list) ────────────────── */}
      <BookingCommentPanel
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setHighlightCommentId(null);
          qc.invalidateQueries({ queryKey: ["unread-comments"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }}
        bookingId={bookingId}
        customerName={customerName}
        highlightCommentId={highlightCommentId ?? undefined}
      />

      {/* ── Approval progress + reset ──────────────────────────────────────── */}
      {dialogOpen && user && (
        <ApprovalDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            qc.invalidateQueries({ queryKey: ["approval-records", "booking", bookingId] });
            router.refresh();
          }}
          packageId={bookingId}
          packageName={customerName}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          canReset={can("booking", "reset-approval")}
          module="booking"
        />
      )}

      {/* ── Approve / reject a step ────────────────────────────────────────── */}
      {approveTarget && (
        <ApproveModal
          open={!!approveTarget}
          onClose={() => {
            setApproveTarget(null);
            qc.invalidateQueries({ queryKey: ["approval-records", "booking", bookingId] });
            router.refresh();
          }}
          stepId={approveTarget.stepId}
          stepLabel={approveTarget.stepLabel}
          packageName={customerName}
        />
      )}
    </div>
  );
}
