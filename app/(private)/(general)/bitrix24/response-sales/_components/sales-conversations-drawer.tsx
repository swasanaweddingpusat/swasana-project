"use client";

import { useState } from "react";
import { UserCircle, CallChatRounded, ChatRound, AltArrowRight } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PercakapanDetailDrawer } from "@/app/(private)/(general)/bitrix24/percakapan/_components/percakapan-detail-drawer";

export interface SalesConversation {
  sessionId: string;
  client: string;
  channel: string;
  avgResponseSec: number | null;
  status: "Belum Dibalas" | "Sudah Dibalas";
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  if (sec < 60) return `${sec} dtk`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h} jam ${rem} mnt` : `${h} jam`;
}

export function SalesConversationsDrawer({
  salesName,
  conversations,
  onClose,
}: {
  salesName: string | null;
  conversations: SalesConversation[];
  onClose: () => void;
}) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  return (
    <>
      <Drawer
        isOpen={salesName !== null}
        onClose={onClose}
        title={salesName ?? ""}
        maxWidth="sm:max-w-md"
      >
        <div className="flex flex-col gap-2 px-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <UserCircle weight="BoldDuotone" className="h-4 w-4" />
            <span>{conversations.length} percakapan</span>
          </div>

          {conversations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada percakapan.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.sessionId}
                type="button"
                onClick={() => setSelectedSession(c.sessionId)}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                    <ChatRound weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.client}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CallChatRounded weight="BoldDuotone" className="h-3 w-3" />
                      {c.channel}
                      <Badge
                        variant={c.status === "Belum Dibalas" ? "destructive" : "secondary"}
                        className="rounded-full px-1.5 py-0 text-[10px] leading-4"
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "text-right text-xs font-medium tabular-nums",
                      c.status === "Belum Dibalas" && "text-destructive",
                    )}
                  >
                    {c.status === "Belum Dibalas" ? "—" : formatDuration(c.avgResponseSec)}
                  </span>
                  <AltArrowRight weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </Drawer>

      <PercakapanDetailDrawer
        sessionId={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </>
  );
}
