"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AltArrowLeft,
  Eye,
  ChatRound,
  Plain,
  CheckCircle,
  User,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { addMemoComment, markMemoAsRead } from "@/actions/memo";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemoDetail {
  id: string;
  noMemo: string;
  judul: string;
  perihal: string | null;
  ruangLingkup: string | null;
  kepada: string | null;
  tembusan: string | null;
  jenisInformasi: string | null;
  klasifikasi: string | null;
  yangMenyetujui: string | null;
  yangMengetahui: string | null;
  isiMemo: string | null;
  status: "draft" | "review" | "published";
  venueId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string | null };
  venue: { id: string; name: string } | null;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; fullName: string | null; role: { name: string } | null };
  }>;
  readers: Array<{
    id: string;
    seenAt: string;
    reader: { id: string; fullName: string | null; role: { name: string } | null };
  }>;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchMemoDetail(id: string): Promise<MemoDetail> {
  const res = await fetch(`/api/memos/${id}`);
  if (!res.ok) throw new Error("Failed to fetch memo");
  return res.json() as Promise<MemoDetail>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <Badge className="rounded-full text-xs bg-primary/10 text-primary border-0">
        Published
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge className="rounded-full text-xs bg-accent text-accent-foreground border-0">
        Review
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full text-xs">
      Draft
    </Badge>
  );
}

type CommentItem = MemoDetail["comments"][number];

function CommentBubble({ comment }: { comment: CommentItem }) {
  const authorName = comment.author.fullName ?? "Unknown";
  const authorRole = comment.author.role?.name ?? "Staff";
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
          {getInitials(authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {authorName}
          </span>
          <Badge variant="secondary" className="rounded-full text-xs px-2 py-0">
            {authorRole}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1 leading-relaxed">{comment.content}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MemoDetailClientProps {
  memoId: string;
}

export function MemoDetailClient({ memoId }: MemoDetailClientProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: memo, isLoading } = useQuery({
    queryKey: ["memos", memoId],
    queryFn: () => fetchMemoDetail(memoId),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => addMemoComment(memoId, { content }),
    onSuccess: (res) => {
      if (res.success) {
        void qc.invalidateQueries({ queryKey: ["memos", memoId] });
        setNewComment("");
        toast.success("Komentar terkirim");
      } else {
        toast.error(res.error ?? "Gagal mengirim komentar");
      }
    },
  });

  useEffect(() => {
    if (memo) {
      void markMemoAsRead(memoId);
    }
  }, [memo, memoId]);

  function handleSendComment(): void {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    commentMutation.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSendComment();
    }
  }

  if (isLoading || !memo) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-96 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-3" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 mt-0.5"
          onClick={() => router.push("/internal-faq/memo")}
        >
          <AltArrowLeft weight="BoldDuotone" className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-heading font-bold text-foreground leading-tight">
              {memo.judul}
            </h1>
            <StatusBadge status={memo.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {memo.noMemo} &mdash; {formatDate(memo.createdAt)} &mdash;{" "}
            {memo.venue?.name ?? "PT Swasana"}
          </p>
        </div>
      </div>

      {/* ── 2-Panel Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Left Panel: Diskusi (2/5) */}
        <Card className="rounded-2xl shadow-sm lg:col-span-2 flex flex-col">
          <CardContent className="p-0 flex flex-col h-full">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b">
              <ChatRound weight="BoldDuotone" className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground text-sm">Diskusi</span>
              <Badge variant="secondary" className="rounded-full text-xs ml-auto">
                {memo.comments.length}
              </Badge>
            </div>

            {/* Comment list */}
            <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "480px" }}>
              <div className="flex flex-col gap-5 px-5 py-4">
                {memo.comments.map((comment, index) => (
                  <div key={comment.id}>
                    <CommentBubble comment={comment} />
                    {index < memo.comments.length - 1 && (
                      <Separator className="mt-5" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t px-5 py-4 flex flex-col gap-3">
              <Textarea
                placeholder="Tulis komentar... (Ctrl+Enter untuk kirim)"
                className="rounded-xl resize-none text-sm min-h-20"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
              <Button
                className="rounded-full self-end gap-2"
                size="sm"
                onClick={handleSendComment}
                disabled={!newComment.trim() || commentMutation.isPending}
              >
                <Plain weight="BoldDuotone" className="h-4 w-4" />
                Kirim
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Dokumen Memo (3/5) */}
        <Card className="rounded-2xl shadow-sm lg:col-span-3">
          <CardContent className="p-0">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-6 py-4 border-b">
              <Eye weight="BoldDuotone" className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground text-sm">Dokumen Memo</span>
            </div>

            {/* Formal document */}
            <ScrollArea style={{ maxHeight: "580px" }}>
              <div className="px-6 py-6">
                <div
                  className={cn(
                    "bg-card border rounded-xl shadow-sm p-8",
                    "prose-memo"
                  )}
                >
                  {/* Company letterhead */}
                  <div className="text-center mb-6">
                    <p className="font-heading font-bold text-lg text-foreground">
                      {memo.venue?.name ?? "PT Swasana Pusat"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MEMO INTERNAL
                    </p>
                  </div>

                  <Separator className="mb-6" />

                  {/* Meta fields table */}
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-6">
                    <MetaRow label="No. Memo" value={memo.noMemo} mono />
                    <MetaRow label="Perihal" value={memo.perihal ?? "-"} />
                    <MetaRow label="Kepada" value={memo.kepada ?? "-"} />
                    <MetaRow label="Tembusan" value={memo.tembusan ?? "-"} />
                    <MetaRow label="Tanggal" value={formatDate(memo.createdAt)} />
                    <MetaRow label="Klasifikasi" value={memo.klasifikasi ?? "-"} />
                    <MetaRow label="Jenis" value={memo.jenisInformasi ?? "-"} />
                    <MetaRow label="Ruang Lingkup" value={memo.ruangLingkup ?? "-"} />
                  </div>

                  <Separator className="mb-6" />

                  {/* Body content */}
                  <div
                    className="text-sm text-foreground leading-relaxed [&_p]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: memo.isiMemo ?? "" }}
                  />

                  <Separator className="mt-8 mb-6" />

                  {/* Signature section */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                    <SignatureBlock
                      label="Disusun Oleh"
                      name={memo.createdBy.fullName ?? "-"}
                      title=""
                    />
                    <SignatureBlock
                      label="Yang Mengetahui"
                      name={memo.yangMengetahui ?? "-"}
                      title=""
                    />
                    <SignatureBlock
                      label="Yang Menyetujui"
                      name={memo.yangMenyetujui ?? "-"}
                      title=""
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── Read Status Section ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          {/* Section header */}
          <div className="flex items-center gap-2 px-6 py-4 border-b">
            <User weight="BoldDuotone" className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground text-sm">
              Status Pembacaan
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {memo.readers.length} orang sudah membaca
            </span>
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle
                weight="BoldDuotone"
                className="h-5 w-5 text-primary"
              />
              <span className="font-semibold text-foreground text-sm">
                Sudah Dilihat
              </span>
              <Badge className="rounded-full bg-primary/10 text-primary border-0 text-xs ml-auto">
                {memo.readers.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-3">
              {memo.readers.map((entry) => (
                <ReaderRow
                  key={entry.id}
                  name={entry.reader.fullName ?? "Unknown"}
                  role={entry.reader.role?.name ?? "Staff"}
                  seenAt={entry.seenAt}
                  seen
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span
        className={cn(
          "text-foreground",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </span>
    </>
  );
}

function SignatureBlock({
  label,
  name,
  title,
}: {
  label: string;
  name: string;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      <div className="h-16 w-full border-b border-dashed border-border mt-2" />
      <p className="text-sm font-semibold text-foreground mt-1">{name}</p>
      {title ? (
        <p className="text-xs text-muted-foreground">{title}</p>
      ) : null}
    </div>
  );
}

function ReaderRow({
  name,
  role,
  seen,
  seenAt,
}: {
  name: string;
  role: string;
  seen: boolean;
  seenAt?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-medium",
            seen
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground leading-tight">
            {name}
          </span>
          <Badge
            variant={seen ? "default" : "secondary"}
            className={cn(
              "rounded-full text-xs px-2 py-0",
              seen && "bg-primary/10 text-primary border-0"
            )}
          >
            {role}
          </Badge>
        </div>
        {seen && seenAt ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Dilihat: {formatDateTime(seenAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
