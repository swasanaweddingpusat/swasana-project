"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChatRound, UserCircle, ClockCircle } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Render Bitrix BBCode into React nodes. Supports [b]bold[/b], [URL=...]label[/URL],
// [USER=id]name[/USER] (rendered as a plain name — no link), and preserves
// newlines. No dangerouslySetInnerHTML — everything is built from plain strings
// + React elements, so message text stays inert.
function renderBbcode(text: string): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) out.push(<br key={`br-${lineIdx}`} />);

    // Tokenize [b]...[/b], [URL=...]...[/URL], and [USER=...]...[/USER].
    const parts: ReactNode[] = [];
    const regex =
      /\[b\]([\s\S]*?)\[\/b\]|\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]|\[USER=\d+\s+REPLACE\]([\s\S]*?)\[\/USER\]/gi;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      if (match[1] !== undefined) {
        parts.push(<strong key={`b-${lineIdx}-${key++}`}>{match[1]}</strong>);
      } else if (match[2] !== undefined) {
        parts.push(
          <a
            key={`u-${lineIdx}-${key++}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {match[3] || match[2]}
          </a>,
        );
      } else if (match[4] !== undefined) {
        // [USER=...] — render the name only, styled as an agent mention.
        parts.push(
          <span key={`usr-${lineIdx}-${key++}`} className="font-medium text-foreground">
            {match[4]}
          </span>,
        );
      }
      last = regex.lastIndex;
    }

    if (last < line.length) parts.push(line.slice(last));
    out.push(<span key={`l-${lineIdx}`}>{parts}</span>);
  });

  return out;
}

interface DetailMessage {
  id: string;
  date: string;
  senderid: string;
  isSystem: boolean;
  isCustomer: boolean;
  isAgent: boolean;
  text: string;
}

interface TransferEvent {
  at: string;
  fromUserId: string | null;
  toUserId: string;
  fromName?: string | null;
  toName?: string | null;
}

interface AgentResponse {
  userId: string;
  name: string;
  samples: number;
  avgSeconds: number;
}

interface DetailData {
  session: {
    sessionId: number;
    chatId: number;
    messageCount: number;
    dateCreate: string | null;
    entityId: string | null;
    entityData1: string | null;
    entityData2: string | null;
  };
  client: { id: string; name: string } | null;
  events: TransferEvent[];
  responseByAgent: AgentResponse[];
  messages: DetailMessage[];
  error?: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(sec: number): string {
  if (sec <= 0) return "-";
  if (sec < 60) return `${sec} dtk`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `${h} jam ${rem} mnt`;
}

export function PercakapanDetailDrawer({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(`/api/bitrix/percakapan/${encodeURIComponent(sessionId)}`);
        const json = (await res.json()) as DetailData;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat detail.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Gagal terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <Drawer
      isOpen={sessionId !== null}
      onClose={onClose}
      title={data?.client?.name ?? `Sesi #${sessionId ?? ""}`}
      maxWidth="sm:max-w-lg"
      childrenClassName="px-1"
    >
      {loading ? (
        <div className="space-y-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
      ) : data ? (
        <div className="flex flex-col gap-5 px-4">
          {/* Ringkasan sesi */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <ChatRound weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">Sesi #{data.session.sessionId}</span>
            </div>
            {data.session.dateCreate && (
              <p className="text-xs text-muted-foreground">
                Dibuat {formatTime(data.session.dateCreate)} · {data.session.messageCount} pesan
              </p>
            )}
          </div>

          {/* Response per agent */}
          {data.responseByAgent.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-heading text-sm font-semibold">Waktu Respons Sales</h4>
              <div className="flex flex-col gap-2">
                {data.responseByAgent.map((a) => (
                  <div
                    key={a.userId}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <UserCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      {a.name}
                    </span>
                    <span className="font-medium tabular-nums">{formatDuration(a.avgSeconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events (assign/transfer) */}
          {data.events.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-heading text-sm font-semibold">Riwayat Assignment</h4>
              <div className="flex flex-col gap-1.5">
                {data.events.map((e, i) => (
                  <div key={`${e.at}-${i}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ClockCircle weight="BoldDuotone" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {formatTime(e.at)} ·{" "}
                      {e.fromName ? (
                        <>
                          ditransfer dari <span className="font-medium text-foreground">{e.fromName}</span> ke{" "}
                          <span className="font-medium text-foreground">{e.toName ?? `#${e.toUserId}`}</span>
                        </>
                      ) : (
                        <>
                          ditugaskan ke <span className="font-medium text-foreground">{e.toName ?? `#${e.toUserId}`}</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline pesan — chat bubbles; system messages as plain centered text */}
          <div className="space-y-2">
            <h4 className="font-heading text-sm font-semibold">Percakapan</h4>
            <div className="flex flex-col gap-2">
              {data.messages.map((m) => {
                if (m.isSystem) {
                  // System event (assign/transfer/status) — plain muted text, no bubble.
                  return (
                    <div key={m.id} className="flex justify-center">
                      <span className="inline-block max-w-[85%] text-center text-[11px] leading-relaxed text-muted-foreground">
                        {m.text ? renderBbcode(m.text) : "(lampiran)"}
                      </span>
                    </div>
                  );
                }

                const isCustomer = m.isCustomer;
                return (
                  <div
                    key={m.id}
                    className={cn("flex w-full", isCustomer ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                        isCustomer
                          ? "rounded-bl-sm border border-border bg-card"
                          : "rounded-br-sm bg-primary text-primary-foreground",
                      )}
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-3">
                        <span className={cn("text-[11px]", isCustomer ? "text-muted-foreground" : "text-primary-foreground/70")}>
                          {isCustomer ? data.client?.name ?? "Customer" : "Sales"}
                        </span>
                        <span className={cn("text-[10px]", isCustomer ? "text-muted-foreground" : "text-primary-foreground/60")}>
                          {formatTime(m.date)}
                        </span>
                      </div>
                      {m.text ? (
                        <p className="break-words whitespace-normal">{renderBbcode(m.text)}</p>
                      ) : (
                        <p className="text-xs italic opacity-70">(lampiran)</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
