import type { SessionHistory, SessionHistoryMessage } from "@/lib/bitrix";

export interface ResponseSample {
  userId: string;
  seconds: number;
}

export interface TransferEvent {
  at: string;
  fromUserId: string | null;
  toUserId: string;
}

/**
 * Extract the target agent id from an assignment / transfer system message.
 *
 * Shapes observed in the portal:
 *   - "Permintaan ditugaskan kepada [USER=37 REPLACE]Kediaman Corp[/USER]"
 *   - "...mentransfer percakapan ke [USER=121 REPLACE]Mutiara Puspasari[/USER]"
 *
 * The generic queue assignment ("semua agen dalam antrean") carries no specific
 * [USER=...] target, so it returns null and is skipped.
 */
export function extractTransferTarget(text: string): string | null {
  if (!text) return null;
  // Transfer shape has two [USER=...] tags: "Fauzan mentransfer percakapan ke
  // Mutiara". The target is the one AFTER "mentransfer percakapan ke".
  const transfer = text.match(/mentransfer percakapan ke \[USER=(\d+)\s+REPLACE\]/);
  if (transfer) return transfer[1];
  // Assignment to a specific agent has a single target tag.
  const assign = text.match(/ditugaskan kepada \[USER=(\d+)\s+REPLACE\]/);
  if (assign) return assign[1];
  return null;
}

/**
 * Walk a session's message history and compute one response sample per
 * assign/transfer AFTER the initial default assignment.
 *
 * The FIRST assign/transfer event is the default queue assignment (e.g.
 * "Permintaan ditugaskan kepada Kediaman Corp") — it is NOT a response-timing
 * event. Timing starts from the 2nd event onwards: the time from when an agent
 * received the conversation (assign/transfer system message) to that agent's
 * first subsequent message. This matches how response time is measured in the
 * Response Sales report.
 *
 * Customer messages are identified via `users.*.connector === true`; system
 * messages use `senderid === "0"`. Everything else is treated as an agent.
 */
export function parseResponseSamples(history: SessionHistory): {
  samples: ResponseSample[];
  events: TransferEvent[];
} {
  const samples: ResponseSample[] = [];
  const events: TransferEvent[] = [];

  const messages = Object.values(history.message ?? {});
  if (messages.length === 0) return { samples, events };

  const customerIds = new Set(
    Object.values(history.users ?? {})
      .filter((u) => u.connector === true)
      .map((u) => u.id),
  );

  const sorted = [...messages].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // userId → assign/transfer timestamp. Only the latest open assignment per
  // agent is tracked; a new assignment overwrites any pending one.
  const pending = new Map<string, string>();

  // The first assign/transfer event is the DEFAULT queue assignment — skip it
  // entirely (no sample, no history entry). Timing starts from the 2nd event.
  let isFirstEvent = true;

  for (const msg of sorted) {
    const sender = msg.senderid;

    if (sender === "0") {
      const target = extractTransferTarget(msg.text);
      if (target) {
        if (isFirstEvent) {
          isFirstEvent = false;
          continue;
        }
        const from = extractTransferFrom(msg);
        pending.set(target, msg.date);
        events.push({ at: msg.date, fromUserId: from, toUserId: target });
      }
      continue;
    }

    if (customerIds.has(sender)) continue;

    const assignedAt = pending.get(sender);
    if (!assignedAt) continue;

    const seconds = diffSeconds(assignedAt, msg.date);
    if (seconds !== null && seconds >= 0) {
      samples.push({ userId: sender, seconds });
    }
    pending.delete(sender);
  }

  return { samples, events };
}

// The transfer message has a [USER=from] subject before the "mentransfer"
// keyword; assignment messages have no meaningful "from". Keep it best-effort.
function extractTransferFrom(msg: SessionHistoryMessage): string | null {
  const m = msg.text.match(/\[USER=(\d+)\s+REPLACE\][^\]]*mentransfer/);
  return m ? m[1] : null;
}

function diffSeconds(start: string, end: string): number | null {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.round((e - s) / 1000);
}

export function avgSeconds(samples: ResponseSample[]): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, s) => acc + s.seconds, 0);
  return Math.round(sum / samples.length);
}
