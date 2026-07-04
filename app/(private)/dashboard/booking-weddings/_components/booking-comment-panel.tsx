"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plain, CloseCircle, Paperclip, Gallery, FileText, Reply, Pen, TrashBinTrash, CheckCircle, Refresh, ChatRound, AddCircle, Microphone, SmileCircle, MenuDots } from "@solar-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { VoiceRecorder } from "@/components/shared/voice-recorder";
import { VoiceNotePlayer } from "@/components/shared/voice-note-player";
import { MessageReactions, QuickReactionBar } from "@/components/shared/message-reactions";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { FormatToolbar } from "@/components/shared/format-toolbar";
import { RichTextInput, type RichTextInputHandle } from "@/components/shared/rich-text-input";
import { LinkPreviewCard, BubbleLinkPreview } from "@/components/shared/link-preview-card";
import { applyFormat, renderWhatsappContent, type FormatType } from "@/lib/whatsapp-format";
import { useBookingComments } from "@/hooks/use-booking-comments";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import { createBookingComment, editBookingComment, deleteBookingComment, markCommentsRead, toggleCommentReaction } from "@/actions/booking-comment";
import type { BookingCommentItem, AggregatedReaction } from "@/lib/queries/booking-comments";
import type { MentionableUser } from "@/lib/queries/users";
import { cn } from "@/lib/utils";

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

/** Preview label for a comment — falls back to attachment type when text is empty (VN, image, file) */
function commentPreviewText(content: string, attachments: unknown): string {
  const text = content.trim();
  if (text) return text;
  const list = Array.isArray(attachments) ? (attachments as { type?: string }[]) : [];
  const first = list[0];
  if (first?.type?.startsWith("audio/")) return "🎤 Pesan suara";
  if (first?.type?.startsWith("image/")) return "📷 Foto";
  if (list.length > 0) return "📎 Lampiran";
  return "";
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

// ─── Mention token detection ──────────────────────────────────────────────────

/**
 * Returns the `@query` token being typed at the current caret position,
 * or null if the caret is not inside a mention token.
 */
function getMentionQuery(value: string, caretPos: number): string | null {
  const textBefore = value.slice(0, caretPos);
  // Walk backwards from caret to find the nearest '@'
  const atIdx = textBefore.lastIndexOf("@");
  if (atIdx === -1) return null;
  // If there's a space between '@' and caret, the user is no longer typing a mention
  const tokenAfterAt = textBefore.slice(atIdx + 1);
  if (tokenAfterAt.includes(" ") && tokenAfterAt.trimEnd() !== tokenAfterAt) return null;
  // Allow up to one space in the name (e.g. "Budi S") — but not two consecutive spaces
  if (/\s{2,}/.test(tokenAfterAt)) return null;
  // Max 40 chars for a name token
  if (tokenAfterAt.length > 40) return null;
  return tokenAfterAt;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateBadge({ date }: { date: Date }) {
  return (
    <div className={cn('flex', 'items-center', 'gap-2', 'my-3')}>
      <div className={cn('flex-1', 'h-px', 'bg-border')} />
      <span className={cn('text-[10px]', 'text-muted-foreground', 'font-medium', 'px-2', 'py-0.5', 'bg-muted', 'rounded-full', 'shrink-0')}>
        {dateBadgeLabel(date)}
      </span>
      <div className={cn('flex-1', 'h-px', 'bg-border')} />
    </div>
  );
}

// ─── Mention Dropdown ─────────────────────────────────────────────────────────

interface MentionDropdownProps {
  users: MentionableUser[];
  query: string;
  activeIndex: number;
  onSelect: (user: MentionableUser) => void;
}

function MentionDropdown({ users, query, activeIndex, onSelect }: MentionDropdownProps) {
  const filtered = users
    .filter((u) => (u.fullName ?? "").toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div className={cn(
      'absolute', 'bottom-full', 'left-0', 'mb-1',
      'w-72', 'max-h-52', 'overflow-y-auto',
      'bg-card', 'border', 'border-border', 'rounded-xl',
      'shadow-md', 'z-50', 'py-1'
    )}>
      {filtered.map((user, idx) => (
        <button
          key={user.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(user); }}
          className={cn(
            'w-full', 'flex', 'items-center', 'gap-2.5',
            'px-3', 'py-2', 'text-left', 'text-sm',
            'transition-colors', 'cursor-pointer',
            idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
          )}
        >
          <div className={cn(
            'shrink-0', 'w-7', 'h-7', 'rounded-full',
            'overflow-hidden', 'bg-secondary', 'flex', 'items-center',
            'justify-center', 'text-[10px]', 'font-semibold', 'text-secondary-foreground'
          )}>
            {user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.avatarUrl} alt={user.fullName ?? ""} className={cn('w-full', 'h-full', 'object-cover')} />
              : getInitials(user.fullName)
            }
          </div>
          <span className="truncate text-foreground min-w-0 flex-1">{user.fullName}</span>
          {user.role?.name && (
            <span className={cn(
              'shrink-0', 'px-1.5', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-medium',
              'bg-secondary', 'text-secondary-foreground', 'border', 'border-border'
            )}>
              {user.role.name}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingAttachment { type: "image" | "document"; url: string; name: string; size: number; blob: Blob }
interface SelectedMention { profileId: string; name: string }

/** Attachment shape inside bubble — extends upload result with audio metadata + optimistic flag */
interface CommentAttachmentLocal {
  path: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  _uploading?: boolean;
  duration?: number;
  peaks?: number[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string | null;
  customerName: string;
  highlightCommentId?: string;
}

export function BookingCommentPanel({ open, onClose, bookingId, customerName, highlightCommentId }: Props) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const { data: comments = [], isLoading } = useBookingComments(open ? bookingId : null, highlightCommentId);
  const { users: mentionableUsers } = useMentionableUsers();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<BookingCommentItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [quickReactId, setQuickReactId] = useState<string | null>(null);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [debouncedPreviewUrl, setDebouncedPreviewUrl] = useState<string | null>(null);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);

  // Debounce preview URL so link metadata only fetches after typing settles
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPreviewUrl(previewUrl), 600);
    return () => clearTimeout(t);
  }, [previewUrl]);

  // Show format toolbar whenever there's a non-collapsed selection inside the editor
  useEffect(() => {
    const onSelChange = () => {
      const el = textareaRef.current?.getElement();
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setShowFormatToolbar(false);
        return;
      }
      const range = sel.getRangeAt(0);
      setShowFormatToolbar(el.contains(range.commonAncestorContainer) && sel.toString().length > 0);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<SelectedMention[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<RichTextInputHandle>(null);
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

  const lastMarkReadRef = useRef<number>(0);

  // Mark as read when panel opens
  useEffect(() => {
    if (open && bookingId) { markCommentsRead(bookingId); lastMarkReadRef.current = Date.now(); }
  }, [open, bookingId]);

  // Auto-scroll ke comment yang di-mention dari deep-link
  useEffect(() => {
    if (!open || !highlightCommentId || isLoading) return;
    const timer = setTimeout(() => {
      const el = messageRefs.current.get(highlightCommentId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(highlightCommentId);
      const clearTimer = setTimeout(() => setHighlightedId(null), 2500);
      return () => clearTimeout(clearTimer);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, highlightCommentId, isLoading]);

  // Scroll to bottom + throttled mark as read on new comments
  useEffect(() => {
    if (!open) return;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    qc.invalidateQueries({ queryKey: ["unread-comments"] });
    // Throttle markCommentsRead — max 1x per 15s
    if (bookingId && Date.now() - lastMarkReadRef.current > 15000) {
      markCommentsRead(bookingId);
      lastMarkReadRef.current = Date.now();
    }
  }, [open, comments.length, bookingId, qc]);

  const resetPanel = () => {
    setInput(""); textareaRef.current?.setValue(""); setReplyTo(null); setEditingId(null); setPendingAttachments([]);
    setMentionQuery(null); setSelectedMentions([]); setRecording(false); setEmojiPickerOpen(false);
  };

  // ─── Mention helpers ─────────────────────────────────────────────────────────

  const filteredMentionUsers = mentionQuery !== null
    ? mentionableUsers
        .filter((u) => (u.fullName ?? "").toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  const insertMention = useCallback((user: MentionableUser) => {
    const editor = textareaRef.current;
    if (!editor) return;
    const name = user.fullName ?? "";
    // Replace the "@query" token before the caret with "@name "
    editor.replaceMention(name, (mentionQuery ?? "").length);
    setSelectedMentions((prev) => {
      const exists = prev.some((m) => m.profileId === user.id);
      if (exists) return prev;
      return [...prev, { profileId: user.id, name }];
    });
    setMentionQuery(null);
    setMentionActiveIdx(0);
  }, [mentionQuery]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  /** Reply with auto-focus on textarea */
  const handleReply = useCallback((comment: BookingCommentItem) => {
    setReplyTo(comment);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  /** Insert emoji at current caret position in the editor */
  const insertEmoji = (emoji: string) => {
    textareaRef.current?.insertText(emoji);
    setEmojiPickerOpen(false);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    // URL preview detection
    const urlMatch = val.match(/https?:\/\/[^\s]+/);
    setPreviewUrl(urlMatch ? urlMatch[0] : null);
  };

  /** Called by RichTextInput with the visible text before the caret — mention detection */
  const handleCaret = (textBeforeCaret: string) => {
    const query = getMentionQuery(textBeforeCaret, textBeforeCaret.length);
    setMentionQuery(query);
    setMentionActiveIdx(0);
  };

  const handleFormat = (type: FormatType) => {
    const editor = textareaRef.current;
    if (!editor) return;
    // Inline formats use live DOM toggling; line-prefix formats rewrite the value.
    if (type === "bold" || type === "italic" || type === "strike" || type === "mono") {
      editor.applyInline(type);
    } else {
      const { text } = applyFormat(input, input.length, input.length, type);
      editor.setValue(text);
    }
    setShowFormatToolbar(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Formatting shortcuts (Ctrl/Cmd) — checked FIRST so nothing else swallows them.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "b") { e.preventDefault(); handleFormat("bold"); return; }
      if (key === "i") { e.preventDefault(); handleFormat("italic"); return; }
      if (key === "e") { e.preventDefault(); handleFormat("mono"); return; }
      if (e.shiftKey && key === "x") { e.preventDefault(); handleFormat("strike"); return; }
    }

    // When mention dropdown is open, intercept navigation keys
    if (mentionQuery !== null && filteredMentionUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActiveIdx((prev) => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActiveIdx((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = filteredMentionUsers[mentionActiveIdx];
        if (selected) insertMention(selected);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Default: Enter without shift = send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSend = async () => {
    if (!bookingId) return;
    const text = input.trim();
    if (!text && !pendingAttachments.length) return;

    // Build mentions array: profileIds of selectedMentions that still appear as @name in text
    const mentionIds = selectedMentions
      .filter((m) => text.includes(`@${m.name}`))
      .map((m) => m.profileId);
    const uniqueMentionIds = [...new Set(mentionIds)];

    // Optimistic — inject ke cache dulu
    const tempId = `optimistic-${Date.now()}`;
    const capturedAttachments = [...pendingAttachments];
    const capturedReplyTo = replyTo;
    const optimisticComment: BookingCommentItem = {
      id: tempId,
      content: text,
      mentions: uniqueMentionIds,
      edited: false,
      attachments: capturedAttachments.length ? capturedAttachments.map((a) => ({ path: "", name: a.name, size: a.size, type: a.type, url: a.url, _uploading: true })) : [],
      createdAt: new Date(),
      author: { id: user?.profileId ?? "", fullName: user?.name ?? "Kamu", avatarUrl: null },
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, attachments: replyTo.attachments, author: { fullName: replyTo.author.fullName } } : null,
      reactions: [],
    };

    qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], (prev) => [...(prev ?? []), optimisticComment]);
    setOptimisticIds((prev) => new Set(prev).add(tempId));
    setInput(""); textareaRef.current?.setValue(""); setPendingAttachments([]); setReplyTo(null);
    setSelectedMentions([]); setMentionQuery(null); setShowFormatToolbar(false);
    setPreviewUrl(null); setDebouncedPreviewUrl(null); setDismissedPreviewUrl(null);
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
      bookingId, content: text, mentions: uniqueMentionIds,
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
    qc.invalidateQueries({ queryKey: ["unread-comments"] });
    textareaRef.current?.focus();
  };

  /** Send a recorded voice note: upload blob, then createBookingComment with audio attachment */
  const handleSendVoice = async ({ blob, duration, peaks }: { blob: Blob; duration: number; peaks: number[] }) => {
    if (!bookingId) return;
    setRecording(false);

    const capturedReplyTo = replyTo;
    setReplyTo(null);

    const mimeType = blob.type || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const fileName = `voice-note.${ext}`;

    // Optimistic — skeleton shown during _uploading
    const tempId = `optimistic-${Date.now()}`;
    const optimisticVn: BookingCommentItem = {
      id: tempId,
      content: "",
      mentions: [],
      edited: false,
      attachments: [{ path: "", name: fileName, size: blob.size, type: mimeType, _uploading: true, duration, peaks }],
      createdAt: new Date(),
      author: { id: user?.profileId ?? "", fullName: user?.name ?? "Kamu", avatarUrl: null },
      replyTo: capturedReplyTo
        ? { id: capturedReplyTo.id, content: capturedReplyTo.content, attachments: capturedReplyTo.attachments, author: { fullName: capturedReplyTo.author.fullName } }
        : null,
      reactions: [],
    };

    qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], (prev) => [...(prev ?? []), optimisticVn]);
    setOptimisticIds((prev) => new Set(prev).add(tempId));
    setSending(true);

    // Upload audio
    const fd = new FormData();
    fd.append("files", blob, fileName);
    let uploadedAttachment: { path: string; name: string; size: number; type: string } | null = null;
    const res = await fetch("/api/bookings/comments/upload", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json() as { attachments: { path: string; name: string; size: number; type: string }[] };
      uploadedAttachment = data.attachments[0] ?? null;
    }

    const attachments = uploadedAttachment
      ? [{ ...uploadedAttachment, duration, peaks }]
      : [];

    const result = await createBookingComment({
      bookingId,
      content: "",
      mentions: [],
      replyToId: capturedReplyTo?.id,
      // duration & peaks stored in JSONB — TypeScript allows structural subtype assignment
      attachments: attachments as { path: string; name: string; size: number; type: string }[],
    });

    setSending(false);
    setOptimisticIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });

    if (!result.success) {
      qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], (prev) => (prev ?? []).filter((c) => c.id !== tempId));
      toast.error(result.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ["booking-comments", bookingId] });
    qc.invalidateQueries({ queryKey: ["unread-comments"] });
  };

  /** Toggle emoji reaction with optimistic cache update */
  const handleToggleReaction = async (commentId: string, emoji: string) => {
    if (!bookingId) return;

    const prevData = qc.getQueryData<BookingCommentItem[]>(["booking-comments", bookingId]) ?? [];

    const nextData = prevData.map((c): BookingCommentItem => {
      if (c.id !== commentId) return c;
      const currentReactions = c.reactions ?? [];
      const existing = currentReactions.find((r) => r.emoji === emoji);
      let newReactions: AggregatedReaction[];

      if (existing) {
        if (existing.reactedByMe) {
          // Remove my reaction
          const newCount = existing.count - 1;
          if (newCount <= 0) {
            newReactions = currentReactions.filter((r) => r.emoji !== emoji);
          } else {
            newReactions = currentReactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: newCount, reactedByMe: false, names: r.names.filter((n) => n !== (user?.name ?? "Kamu")) }
                : r
            );
          }
        } else {
          // Increment existing emoji
          newReactions = currentReactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, reactedByMe: true, names: [...r.names, user?.name ?? "Kamu"] }
              : r
          );
        }
      } else {
        // New emoji
        newReactions = [...currentReactions, { emoji, count: 1, reactedByMe: true, names: [user?.name ?? "Kamu"] }];
      }

      return { ...c, reactions: newReactions };
    });

    qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], nextData);

    const result = await toggleCommentReaction(commentId, emoji);
    if (!result.success) {
      // Rollback
      qc.setQueryData<BookingCommentItem[]>(["booking-comments", bookingId], prevData);
      toast.error(result.error);
      return;
    }
    // Sync with server for accurate names
    qc.invalidateQueries({ queryKey: ["booking-comments", bookingId] });
  };

  const handleEditSave = async (id: string) => {
    if (!bookingId || !editInput.trim()) return;
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

  // Derived: show mic button when input is empty and no attachments and not recording
  const showMicButton = !input.trim() && !pendingAttachments.length && !recording;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) { resetPanel(); onClose(); } }}>
        <SheetContent side="right" className={cn('w-screen!', 'sm:max-w-xl', 'flex', 'flex-col', 'p-0', 'gap-0')} showCloseButton={false}>
          {/* Header */}
          <div className={cn('shrink-0', 'flex', 'items-center', 'justify-between', 'px-5', 'py-4', 'border-b')}>
            <SheetTitle className={cn('text-base', 'sm:text-lg', 'font-semibold', 'text-foreground', 'flex', 'items-center', 'gap-2', 'truncate', 'max-w-[80%]')}>
              <ChatRound weight="BoldDuotone" className={cn('h-5', 'w-5', 'shrink-0', 'text-muted-foreground')} />
              {customerName}
            </SheetTitle>
            <button
              className={cn('flex', 'items-center', 'justify-center', 'min-h-9', 'min-w-9', 'rounded-full', 'bg-destructive/10', 'hover:bg-destructive/20', 'text-destructive', 'cursor-pointer', 'shrink-0')}
              onClick={onClose}
              aria-label="Close"
            >
              <CloseCircle weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-destructive')} />
            </button>
          </div>

          {/* Messages */}
          <div className={cn('flex-1', 'overflow-y-auto', 'px-4', 'py-3')}>
            {isLoading ? (
              <div className={cn('space-y-4', 'py-2')}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                    <div className={cn('w-7', 'h-7', 'rounded-full', 'bg-muted', 'animate-pulse', 'shrink-0', 'mt-0.5')} />
                    <div className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                      <div className={cn('h-3', 'w-16', 'rounded', 'bg-muted', 'animate-pulse')} />
                      <div className={`h-9 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "rounded-tl-sm" : "rounded-tr-sm"}`} style={{ width: `${120 + (i * 30) % 80}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-center')}>
                <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada komentar.</p>
                <p className={cn('text-xs', 'text-muted-foreground', 'mt-1')}>Mulai diskusi di sini.</p>
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
                          className={cn(
                            'flex', 'gap-2', 'group', 'transition-all', 'duration-300', 'rounded-lg',
                            isSelf ? 'flex-row-reverse' : 'flex-row',
                            highlightedId === comment.id ? 'bg-[var(--brand-gold)]/10 outline outline-2 outline-offset-2' : ''
                          )}
                          style={highlightedId === comment.id ? { outlineColor: "var(--brand-gold)" } : undefined}
                        >
                          {/* Avatar */}
                          <div className={cn('shrink-0', 'w-7', 'h-7', 'rounded-full', 'overflow-hidden', 'bg-secondary', 'flex', 'items-center', 'justify-center', 'text-[10px]', 'font-semibold', 'text-secondary-foreground', 'mt-0.5')}>
                            {comment.author.avatarUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={comment.author.avatarUrl} alt={comment.author.fullName ?? ""} className={cn('w-full', 'h-full', 'object-cover')} />
                              : getInitials(comment.author.fullName)
                            }
                          </div>
                          <div className={`max-w-[78%] flex flex-col gap-0.5 ${isSelf ? "items-end" : "items-start"}`}>
                            <span className={cn('text-[10px]', 'text-muted-foreground', 'px-1')}>{isSelf ? "Kamu" : comment.author.fullName}</span>

                            {/* Reply quote */}
                            {comment.replyTo && (
                              <div
                                className={cn('text-[10px]', 'px-2', 'py-1', 'rounded-lg', 'border-l-2', 'border-primary/50', 'bg-muted/60', 'max-w-full', 'cursor-pointer', 'hover:bg-muted')}
                                onClick={() => scrollToMessage(comment.replyTo!.id)}
                              >
                                <span className={cn('font-medium', 'text-primary/70')}>{comment.replyTo.author.fullName}</span>
                                <span className={cn('text-muted-foreground', 'ml-1', 'truncate', 'block')}>{commentPreviewText(comment.replyTo.content, (comment.replyTo as { attachments?: unknown }).attachments).slice(0, 60)}</span>
                              </div>
                            )}

                            {/* Bubble row: dots button di samping bubble */}
                            <div className={cn('flex items-end gap-1', isSelf ? 'flex-row-reverse' : 'flex-row')}>
                              {/* Bubble + reactions nempel */}
                              <div className="relative group/bubble">
                                {/* Quick reaction bar — muncul on hover bubble.
                                    pb-1 (bukan mb-1) bikin area hover nyambung ke bubble, gak ada dead-zone yang bikin bar hilang pas cursor mau klik. */}
                                {editingId !== comment.id && (
                                  <div className={cn(
                                    'absolute bottom-full pb-1 z-20 transition-opacity',
                                    isSelf ? 'right-0' : 'left-0',
                                    quickReactId === comment.id ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto',
                                  )}>
                                    <QuickReactionBar
                                      onToggle={(emoji) => { void handleToggleReaction(comment.id, emoji); }}
                                      isSelf={isSelf}
                                      onPickerOpenChange={(open) => setQuickReactId(open ? comment.id : null)}
                                    />
                                  </div>
                                )}
                                {/* Bubble */}
                                {editingId === comment.id ? (
                                  <div className={cn('flex', 'gap-1', 'items-end', 'w-full')}>
                                    <textarea
                                      value={editInput}
                                      onChange={(e) => setEditInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleEditSave(comment.id); }
                                        if (e.key === "Escape") setEditingId(null);
                                      }}
                                      className={cn('flex-1', 'resize-none', 'rounded-xl', 'border', 'border-border', 'bg-background', 'px-3', 'py-2', 'text-sm', 'focus:outline-none', 'focus:ring-1', 'focus:ring-ring')}
                                      rows={2}
                                      autoFocus
                                    />
                                    <button onClick={() => void handleEditSave(comment.id)} className={cn('p-0.5', 'text-primary', 'hover:text-primary/80')}><CheckCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /></button>
                                    <button onClick={() => setEditingId(null)} className={cn('p-0.5', 'text-muted-foreground', 'hover:text-foreground')}><CloseCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /></button>
                                  </div>
                                ) : (
                                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isSelf ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-secondary-foreground rounded-tl-sm"}`}>
                                    {/* Attachments */}
                                    {Array.isArray(comment.attachments) && (comment.attachments as unknown as CommentAttachmentLocal[]).length > 0 && (
                                      <div className={cn('flex', 'flex-wrap', 'gap-1.5', 'mb-1')}>
                                        {(comment.attachments as unknown as CommentAttachmentLocal[]).map((att, i) => {
                                          if (att._uploading) {
                                            const isImg = att.type.startsWith("image/");
                                            return isImg ? (
                                              <div key={i} className={cn('rounded-lg', 'bg-muted', 'animate-pulse')} style={{ width: 120, height: 90 }} />
                                            ) : (
                                              <div key={i} className={cn('flex', 'items-center', 'gap-2', 'bg-muted', 'animate-pulse', 'rounded-lg', 'px-2', 'py-1.5', 'w-36', 'h-9')} />
                                            );
                                          }
                                          const url = att.url ?? "";
                                          const isAudio = att.type.startsWith("audio/");
                                          const isImg = att.type.startsWith("image/");
                                          if (isAudio) {
                                            return (
                                              <VoiceNotePlayer
                                                key={i}
                                                url={url}
                                                duration={att.duration ?? 0}
                                                peaks={att.peaks ?? []}
                                                isSelf={isSelf}
                                              />
                                            );
                                          }
                                          return isImg ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img key={i} src={url} alt={att.name} className={cn('rounded-lg', 'max-w-45', 'cursor-pointer', 'hover:opacity-90', 'transition-opacity')} onClick={() => setPreviewImage(url)} />
                                          ) : (
                                            <div key={i} className={cn('flex', 'items-center', 'gap-2', 'bg-black/10', 'rounded-lg', 'px-2', 'py-1.5', 'cursor-pointer')} onClick={() => window.open(url, "_blank")}>
                                              <div className={cn('shrink-0', 'flex', 'flex-col', 'items-center', 'justify-center', 'w-8', 'h-8', 'rounded', 'bg-black/10')}>
                                                <FileText weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                                                <span className={cn('text-[8px]', 'font-bold', 'uppercase', 'leading-none', 'mt-0.5')}>
                                                  {att.name.split(".").pop() ?? att.type.split("/")[1]}
                                                </span>
                                              </div>
                                              <div className="min-w-0">
                                                <p className={cn('text-xs', 'font-medium', 'truncate', 'max-w-35')}>{att.name}</p>
                                                <p className={cn('text-[10px]', 'opacity-70')}>{fmtSize(att.size)}</p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Link preview inside bubble (WhatsApp style) */}
                                    {(() => {
                                      const m = comment.content?.match(/https?:\/\/[^\s]+/);
                                      return m ? <BubbleLinkPreview url={m[0]} isSelf={isSelf} /> : null;
                                    })()}
                                    {comment.content && renderWhatsappContent(comment.content, isSelf, (name, key) => (
                                      <span key={key} className={`font-semibold rounded px-0.5 ${isSelf ? "text-primary-foreground/80 underline" : "text-primary"}`}>
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Reactions nempel di bawah bubble — overlap kayak WhatsApp */}
                                {(comment.reactions ?? []).length > 0 && (
                                  <div className={cn('absolute -bottom-4', isSelf ? 'right-0' : 'left-0')}>
                                    <MessageReactions
                                      reactions={comment.reactions ?? []}
                                      onToggle={(emoji) => { void handleToggleReaction(comment.id, emoji); }}
                                      isSelf={isSelf}
                                      align={isSelf ? "end" : "start"}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Dots button — di samping bubble, muncul on hover */}
                              <div className={cn('flex items-center mb-1 transition-opacity', reactionMenuId === comment.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                                <DropdownMenu onOpenChange={(open) => setReactionMenuId(open ? comment.id : null)}>
                                  <DropdownMenuTrigger asChild>
                                    <button className={cn('p-1', 'rounded', 'hover:bg-muted', 'text-muted-foreground', 'hover:text-foreground')}>
                                      <MenuDots weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'rotate-90')} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent side="top" align={isSelf ? "end" : "start"} className="min-w-36">
                                    <DropdownMenuItem onClick={() => handleReply(comment)} className="gap-2 cursor-pointer">
                                      <Reply weight="BoldDuotone" className="h-4 w-4" />
                                      Balas
                                    </DropdownMenuItem>
                                    {isSelf && editingId !== comment.id && (
                                      <>
                                        <DropdownMenuItem onClick={() => { setEditingId(comment.id); setEditInput(comment.content); }} className="gap-2 cursor-pointer">
                                          <Pen weight="BoldDuotone" className="h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setDeleteTarget(comment.id)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                                          Hapus
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Spacer bawah buat reactions yang overlap */}
                            {(comment.reactions ?? []).length > 0 && <div className="h-3" />}

                            {/* Meta: waktu + status */}
                            <div className={`flex items-center gap-1.5 px-1 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
                              <span className={cn('text-[10px]', 'text-muted-foreground')}>{format(new Date(comment.createdAt), "HH:mm")}</span>
                              {comment.edited && <span className={cn('text-[10px]', 'text-muted-foreground', 'italic')}>diedit</span>}
                              {optimisticIds.has(comment.id) && (
                                <span className={cn('text-[10px]', 'text-muted-foreground', 'flex', 'items-center', 'gap-0.5')}>
                                  <span className={cn('inline-flex', 'gap-0.5')}>
                                    {[0, 100, 200].map((d) => (
                                      <span key={d} className={cn('w-1', 'h-1', 'rounded-full', 'bg-muted-foreground', 'animate-bounce')} style={{ animationDelay: `${d}ms` }} />
                                    ))}
                                  </span>
                                </span>
                              )}
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
            <div className={cn('shrink-0', 'mx-3', 'mb-1', 'px-3', 'py-1.5', 'bg-muted', 'rounded-lg', 'border-l-2', 'border-primary', 'flex', 'items-start', 'justify-between', 'gap-2')}>
              <div className="min-w-0">
                <p className={cn('text-[10px]', 'font-medium', 'text-primary')}>{replyTo.author.fullName}</p>
                <p className={cn('text-[10px]', 'text-muted-foreground', 'truncate')}>{commentPreviewText(replyTo.content, replyTo.attachments).slice(0, 80)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className={cn('shrink-0', 'text-muted-foreground', 'hover:text-foreground', 'mt-0.5')}>
                <CloseCircle weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
              </button>
            </div>
          )}

          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className={cn('shrink-0', 'mx-3', 'mb-1', 'flex', 'flex-wrap', 'gap-1.5')}>
              {pendingAttachments.map((a, i) => (
                <div key={i} className={cn('flex', 'items-center', 'gap-2', 'px-2', 'py-1.5', 'bg-muted', 'rounded-lg', 'max-w-45')}>
                  {a.type === "image"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={a.url} alt="" className={cn('h-7', 'w-7', 'rounded', 'object-cover', 'shrink-0')} />
                    : <FileText weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground', 'shrink-0')} />
                  }
                  <span className={cn('text-xs', 'truncate', 'flex-1', 'min-w-0')}>{a.name}</span>
                  <button onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))} className={cn('text-muted-foreground', 'hover:text-foreground', 'shrink-0')}>
                    <CloseCircle weight="BoldDuotone" className={cn('h-3', 'w-3')} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className={cn('shrink-0', 'border-t', 'px-3', 'py-3')}>
            {recording ? (
              /* Voice recorder replaces entire input row */
              <VoiceRecorder
                onSend={(data) => { void handleSendVoice(data); }}
                onCancel={() => setRecording(false)}
              />
            ) : (
              <div className={cn('flex', 'gap-2', 'items-center')}>
                {/* Attachment picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn('h-10', 'w-10', 'flex', 'items-center', 'justify-center', 'rounded-xl', 'border', 'border-border', 'hover:bg-muted', 'text-muted-foreground', 'hover:text-foreground', 'shrink-0')}>
                      <AddCircle weight="BoldDuotone" className={cn('h-5', 'w-5')} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start">
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Gallery weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-2', 'text-muted-foreground')} /> Foto / Gambar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
                      <Paperclip weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-2', 'text-muted-foreground')} /> Dokumen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Emoji insert picker */}
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger
                    className={cn('h-10', 'w-10', 'flex', 'items-center', 'justify-center', 'rounded-xl', 'border', 'border-border', 'hover:bg-muted', 'text-muted-foreground', 'hover:text-foreground', 'shrink-0')}
                    aria-label="Sisipkan emoji"
                  >
                    <SmileCircle weight="BoldDuotone" className={cn('h-5', 'w-5')} />
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-0 w-auto">
                    <EmojiPicker onSelect={insertEmoji} />
                  </PopoverContent>
                </Popover>

                {/* Textarea wrapper — relative for mention dropdown */}
                <div className="relative flex-1">
                  {(() => {
                    const activePreviewUrl = debouncedPreviewUrl && debouncedPreviewUrl !== dismissedPreviewUrl ? debouncedPreviewUrl : null;
                    return activePreviewUrl ? (
                      <div className="absolute bottom-full left-0 right-0 z-30 mb-1">
                        <LinkPreviewCard url={activePreviewUrl} onDismiss={() => setDismissedPreviewUrl(activePreviewUrl)} />
                      </div>
                    ) : null;
                  })()}
                  {showFormatToolbar && (
                    <div className="absolute bottom-full left-0 z-20 mb-1">
                      <FormatToolbar onFormat={handleFormat} />
                    </div>
                  )}
                  {mentionQuery !== null && filteredMentionUsers.length > 0 && (
                    <MentionDropdown
                      users={mentionableUsers}
                      query={mentionQuery}
                      activeIndex={mentionActiveIdx}
                      onSelect={insertMention}
                    />
                  )}
                  <RichTextInput
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onCaret={handleCaret}
                    onKeyDown={handleKeyDown}
                    placeholder="Kirim pesan..."
                    className={cn('w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-normal focus:outline-none focus:ring-1 focus:ring-ring')}
                    style={{ minHeight: "40px", maxHeight: "160px", overflowY: "auto" }}
                  />
                </div>

                {/* Mic / Send toggle */}
                {showMicButton ? (
                  <button
                    type="button"
                    onClick={() => setRecording(true)}
                    className={cn('shrink-0', 'rounded-xl', 'h-10', 'w-10', 'flex', 'items-center', 'justify-center', 'bg-primary', 'text-primary-foreground', 'hover:bg-primary/90', 'transition-colors')}
                    aria-label="Rekam voice note"
                  >
                    <Microphone weight="BoldDuotone" className={cn('h-5', 'w-5')} />
                  </button>
                ) : (
                  <Button size="icon" onClick={() => void handleSend()} disabled={sending || (!input.trim() && !pendingAttachments.length)} className={cn('shrink-0', 'rounded-xl', 'h-10', 'w-10')}>
                    {sending ? <Refresh weight="BoldDuotone" className={cn('h-5', 'w-5', 'animate-spin')} /> : <Plain weight="BoldDuotone" className={cn('h-5', 'w-5')} />}
                  </Button>
                )}
              </div>
            )}
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
        onConfirm={() => void handleDelete(deleteTarget!)}
      />

      {/* Image preview modal */}
      {previewImage && (
        <div
          className={cn('fixed', 'inset-0', 'z-60', 'bg-black/80', 'flex', 'items-center', 'justify-center')}
          onClick={() => setPreviewImage(null)}
        >
          <button className={cn('absolute', 'top-4', 'right-4', 'p-1', 'rounded-full', 'bg-white/10', 'hover:bg-white/20')} onClick={() => setPreviewImage(null)}>
            <CloseCircle weight="BoldDuotone" className={cn('h-6', 'w-6', 'text-background')} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Preview"
            className={cn('max-w-[90vw]', 'max-h-[90vh]', 'rounded-lg', 'object-contain')}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
