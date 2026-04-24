"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Send, X, Paperclip, ImageIcon, FileText, Reply, Pencil, Trash2, Check, Loader2, MessageSquare, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBookingComments } from "@/hooks/use-booking-comments";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createBookingComment, editBookingComment, deleteBookingComment, markCommentsRead } from "@/actions/booking-comment";
import type { BookingCommentItem } from "@/lib/queries/booking-comments";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateBadgeLabel(date: Date) {
  if (isToday(date)) return "Hari ini";
  if (isYesterday(date)) return "Kemarin";
  return format(date, "d MMMM yyyy", { locale: localeId });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function renderContent(content: string, isSelf: boolean) {
  const parts = content.split(/(@\w+(?:\s\w+)?)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className={`font-semibold rounded px-0.5 ${isSelf ? "text-primary-foreground/80 underline" : "text-primary"}`}>
        {part}
      </span>
    ) : part
  );
}

async function compressImage(file: File): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve({ blob: blob!, url: URL.createObjectURL(blob!) }), "image/webp", 0.5);
      };
    };
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateBadge({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full shrink-0">
        {dateBadgeLabel(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

interface PendingAttachment { type: "image" | "document"; url: string; name: string; size: number; blob: Blob }
// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
}

export function BookingCommentPanel({ open, onClose, bookingId, customerName }: Props) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const { data: comments = [], isLoading } = useBookingComments(open ? bookingId : null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<BookingCommentItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-muted/60");
    setTimeout(() => el.classList.remove("bg-muted/60"), 1200);
  };

  // Mark as read when panel opens
  useEffect(() => {
    if (open && bookingId) markCommentsRead(bookingId);
  }, [open, bookingId]);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [open, comments.length]);

  // Reset on close
  useEffect(() => {
    if (!open) { setInput(""); setReplyTo(null); setEditingId(null); setPendingAttachments([]); }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingAttachments.length) return;

    const mentionMatches = text.match(/@(\w+(?:\s\w+)?)/g) ?? [];
    const mentions = mentionMatches.map((m) => m.slice(1));

    // Optimistic — inject ke cache dulu
    const tempId = `optimistic-${Date.now()}`;
    const capturedAttachments = [...pendingAttachments];
    const capturedReplyTo = replyTo;
    const optimisticComment: BookingCommentItem = {
      id: tempId,
      content: text,
      mentions,
      edited: false,
      attachments: capturedAttachments.length ? capturedAttachments.map((a) => ({ path: "", name: a.name, size: a.size, type: a.type, url: a.url, _uploading: true })) : [],
      createdAt: new Date(),
      author: { id: user?.profileId ?? "", fullName: user?.name ?? "Kamu", avatarUrl: null },
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, author: { fullName: replyTo.author.fullName } } : null,
    };

    qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], (prev) => [...(prev ?? []), optimisticComment]);
    setOptimisticIds((prev) => new Set(prev).add(tempId));
    setInput(""); setPendingAttachments([]); setReplyTo(null);
    setSending(true);

    // Upload attachments if any
    let uploadedAttachments: { path: string; name: string; size: number; type: string }[] = [];
    if (capturedAttachments.length) {
      const fd = new FormData();
      for (const a of capturedAttachments) fd.append("files", a.blob, a.name);
      const res = await fetch("/api/bookings/comments/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json() as { attachments: typeof uploadedAttachments };
        uploadedAttachments = data.attachments;
      }
    }

    const result = await createBookingComment({
      bookingId, content: text, mentions,
      replyToId: capturedReplyTo?.id,
      attachments: uploadedAttachments,
    });
    setSending(false);
    setOptimisticIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });

    if (!result.success) {
      qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], (prev) => (prev ?? []).filter((c) => c.id !== tempId));
      toast.error(result.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ["booking-comments", bookingId] });
    if (textareaRef.current) textareaRef.current.style.height = "36px";
    textareaRef.current?.focus();
  }, [input, pendingAttachments, replyTo, bookingId, qc, user]);

  const handleEditSave = async (id: string) => {
    if (!editInput.trim()) return;
    const result = await editBookingComment(id, editInput.trim());
    if (!result.success) { toast.error(result.error); return; }
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["booking-comments", bookingId] });
  };

  const handleDelete = async (id: string) => {
    const result = await deleteBookingComment(id);
    if (!result.success) { toast.error(result.error); return; }
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["booking-comments", bookingId] });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const { blob, url } = await compressImage(file);
      setPendingAttachments((prev) => [...prev, { type: "image", url, name: file.name.replace(/\.[^.]+$/, ".webp"), size: blob.size, blob }]);
    }
    e.target.value = "";
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      setPendingAttachments((prev) => [...prev, { type: "document", url: URL.createObjectURL(file), name: file.name, size: file.size, blob: file }]);
    }
    e.target.value = "";
  };

  // Group by date
  const grouped: { date: Date; items: BookingCommentItem[] }[] = [];
  for (const c of comments) {
    const date = new Date(c.createdAt);
    const last = grouped[grouped.length - 1];
    if (!last || !isSameDay(last.date, date)) grouped.push({ date, items: [c] });
    else last.items.push(c);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-screen! sm:max-w-xl flex flex-col p-0 gap-0" showCloseButton={false}>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b">
            <SheetTitle className="text-base sm:text-lg font-semibold text-[#121417] flex items-center gap-2 truncate max-w-[80%]">
              <MessageSquare className="h-5 w-5 shrink-0 text-muted-foreground" />
              {customerName}
            </SheetTitle>
            <button
              className="p-1 rounded-full bg-red-100 hover:bg-red-200 cursor-pointer shrink-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-red-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="space-y-4 py-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                    <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
                    <div className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                      <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                      <div className={`h-9 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "rounded-tl-sm" : "rounded-tr-sm"}`} style={{ width: `${120 + (i * 30) % 80}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
                <p className="text-xs text-muted-foreground mt-1">Mulai diskusi di sini.</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.date.toISOString()}>
                  <DateBadge date={group.date} />
                  <div className="space-y-2">
                    {group.items.map((comment) => {
                      const isSelf = comment.author.id === user?.profileId;
                      return (
                        <div
                          key={comment.id}
                          ref={(el) => { if (el) messageRefs.current.set(comment.id, el); else messageRefs.current.delete(comment.id); }}
                          className={`flex gap-2 group transition-colors rounded-lg ${isSelf ? "flex-row-reverse" : "flex-row"}`}
                        >
                          {/* Avatar */}
                          <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-semibold text-secondary-foreground mt-0.5">
                            {comment.author.avatarUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={comment.author.avatarUrl} alt={comment.author.fullName ?? ""} className="w-full h-full object-cover" />
                              : getInitials(comment.author.fullName)
                            }
                          </div>
                          <div className={`max-w-[78%] flex flex-col gap-0.5 ${isSelf ? "items-end" : "items-start"}`}>
                            <span className="text-[10px] text-muted-foreground px-1">{isSelf ? "Kamu" : comment.author.fullName}</span>

                            {/* Reply quote */}
                            {comment.replyTo && (
                              <div
                                className="text-[10px] px-2 py-1 rounded-lg border-l-2 border-primary/50 bg-muted/60 max-w-full cursor-pointer hover:bg-muted"
                                onClick={() => scrollToMessage(comment.replyTo!.id)}
                              >
                                <span className="font-medium text-primary/70">{comment.replyTo.author.fullName}</span>
                                <span className="text-muted-foreground ml-1 truncate block">{comment.replyTo.content.slice(0, 60)}</span>
                              </div>
                            )}

                            {/* Bubble */}
                            {editingId === comment.id ? (
                              <div className="flex gap-1 items-end w-full">
                                <textarea
                                  value={editInput}
                                  onChange={(e) => setEditInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(comment.id); } if (e.key === "Escape") setEditingId(null); }}
                                  className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                  rows={2}
                                  autoFocus
                                />
                                <button onClick={() => handleEditSave(comment.id)} className="p-0.5 text-primary hover:text-primary/80"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditingId(null)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                              </div>
                            ) : (
                              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isSelf ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-secondary-foreground rounded-tl-sm"}`}>
                                {/* Attachments */}
                                {Array.isArray(comment.attachments) && (comment.attachments as { path: string; name: string; size: number; type: string; url?: string; _uploading?: boolean }[]).length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-1">
                                    {(comment.attachments as { path: string; name: string; size: number; type: string; url?: string; _uploading?: boolean }[]).map((att, i) => {
                                      if (att._uploading) {
                                        const isImg = att.type.startsWith("image/");
                                        return isImg ? (
                                          <div key={i} className="rounded-lg bg-muted animate-pulse" style={{ width: 120, height: 90 }} />
                                        ) : (
                                          <div key={i} className="flex items-center gap-2 bg-muted animate-pulse rounded-lg px-2 py-1.5 w-36 h-9" />
                                        );
                                      }
                                      const url = att.url ?? "";
                                      const isImg = att.type.startsWith("image/");
                                      return isImg ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={i} src={url} alt={att.name} className="rounded-lg max-w-[180px] cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(url)} />
                                      ) : (
                                        <div key={i} className="flex items-center gap-2 bg-black/10 rounded-lg px-2 py-1.5 cursor-pointer" onClick={() => window.open(url, "_blank")}>
                                          <div className="shrink-0 flex flex-col items-center justify-center w-8 h-8 rounded bg-black/10">
                                            <FileText className="h-3.5 w-3.5" />
                                            <span className="text-[8px] font-bold uppercase leading-none mt-0.5">
                                              {att.name.split(".").pop() ?? att.type.split("/")[1]}
                                            </span>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium truncate max-w-[140px]">{att.name}</p>
                                            <p className="text-[10px] opacity-70">{fmtSize(att.size)}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {comment.content && renderContent(comment.content, isSelf)}
                              </div>
                            )}

                            {/* Meta + hover actions */}
                            <div className={`flex items-center gap-1.5 px-1 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                              <span className="text-[10px] text-muted-foreground">{format(new Date(comment.createdAt), "HH:mm")}</span>
                              {comment.edited && <span className="text-[10px] text-muted-foreground italic">diedit</span>}
                              {optimisticIds.has(comment.id) && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <span className="inline-flex gap-0.5">
                                    {[0, 100, 200].map((d) => (
                                      <span key={d} className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                    ))}
                                  </span>
                                </span>
                              )}
                              <div className={`hidden group-hover:flex items-center gap-0.5 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                                <button onClick={() => setReplyTo(comment)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                  <Reply className="h-3 w-3" />
                                </button>
                                {isSelf && editingId !== comment.id && (
                                  <>
                                    <button onClick={() => { setEditingId(comment.id); setEditInput(comment.content); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => setDeleteTarget(comment.id)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="shrink-0 mx-3 mb-1 px-3 py-1.5 bg-muted rounded-lg border-l-2 border-primary flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-primary">{replyTo.author.fullName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{replyTo.content.slice(0, 80)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className="shrink-0 mx-3 mb-1 flex flex-wrap gap-1.5">
              {pendingAttachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg max-w-[180px]">
                  {a.type === "image"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={a.url} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                    : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <span className="text-xs truncate flex-1 min-w-0">{a.name}</span>
                  <button onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 border-t px-3 py-3 flex gap-2 items-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0">
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Foto / Gambar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" /> Dokumen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ketik komentar... (@ untuk mention)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
              style={{ minHeight: "36px", maxHeight: "160px", overflowY: "auto" }}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || (!input.trim() && !pendingAttachments.length)} className="shrink-0 rounded-xl h-9 w-9">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={handleDocSelect} />
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Hapus Komentar"
        description="Yakin mau hapus komentar ini?"
        confirmLabel="Hapus"
        destructive
        onConfirm={() => handleDelete(deleteTarget!)}
      />

      {/* Image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20" onClick={() => setPreviewImage(null)}>
            <X className="h-6 w-6 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
