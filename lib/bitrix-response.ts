import type { SessionHistory, SessionHistoryMessage } from "@/lib/bitrix";
import { BITRIX_QUEUE_USER_IDS } from "@/lib/bitrix-accounts";

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
 * customer message that an agent actually replied to.
 *
 * A sample is timed from an ANCHOR to the next agent message, and is ONLY
 * counted when the anchor is a TRANSFER/ASSIGN to a real sales — the handoff
 * moment (see pass 2). A sales is measured from when the chat reached them, so a
 * transfer RESETS the anchor: the incoming sales isn't charged for the
 * customer's wait before the handoff. A chat transferred to several sales in
 * turn yields one sample per sales, each timed from its own handoff.
 *
 * An agent who SELF-SELECTS a conversation — replies to a plain unanswered
 * customer message with no handoff to them (e.g. front-desk Fauzan picking a
 * chat off the queue) — produces NO sample: picking a chat yourself isn't a
 * measured response time. That reply still clears the pending anchor (so the
 * `hasPending` / "Belum Dibalas" status stays correct), it just isn't averaged.
 * Likewise a follow-up/nudge with nothing pending (e.g. "belum dibales, follow
 * up lagi besok") produces no sample. If the customer sends several messages
 * before any agent replies, the FIRST of that burst is the anchor.
 *
 * Queue/bot accounts (`BITRIX_QUEUE_USER_IDS`, e.g. "Kediaman Corp" #56663)
 * auto-greet a customer before the chat is transferred to a real sales. If a
 * session IS later transferred to a non-queue user, the queue account's
 * messages are IGNORED for timing — they neither create a sample nor clear
 * the pending customer message, so the real sales' later reply gets measured
 * from the customer's message and the bot's near-instant greeting stays out
 * of the response pool. If a session is NOT transferred to a real sales (the
 * queue account genuinely handled it end to end), the queue account is timed
 * like any other agent so it still appears in the report.
 *
 * Assign/transfer system messages no longer gate timing (previous behavior
 * only measured the first reply after a handoff) — they are walked in pass 1
 * purely to build the `events` transfer-history log (and to detect whether a
 * real-sales transfer happened), unrelated to `samples`. The FIRST
 * assign/transfer event is the default queue assignment (e.g. "Permintaan
 * ditugaskan kepada Kediaman Corp") and is excluded from that log.
 *
 * Customer messages are identified via `users.*.connector === true`; system
 * messages use `senderid === "0"`. Everything else is treated as an agent.
 */
export function parseResponseSamples(history: SessionHistory): {
  samples: ResponseSample[];
  events: TransferEvent[];
  hasPending: boolean;
} {
  const samples: ResponseSample[] = [];
  const events: TransferEvent[] = [];

  const messages = Object.values(history.message ?? {});
  if (messages.length === 0) return { samples, events, hasPending: false };

  const customerIds = new Set(
    Object.values(history.users ?? {})
      .filter((u) => u.connector === true)
      .map((u) => u.id),
  );

  const sorted = [...messages].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // Pass 1 — build the transfer-history log. The first assign/transfer event is
  // the DEFAULT queue assignment, excluded entirely; logged from the 2nd on.
  let isFirstEvent = true;
  for (const msg of sorted) {
    if (msg.senderid !== "0") continue;
    const target = extractTransferTarget(msg.text);
    if (!target) continue;
    if (isFirstEvent) {
      isFirstEvent = false;
      continue;
    }
    events.push({ at: msg.date, fromUserId: extractTransferFrom(msg), toUserId: target });
  }

  // The chat was handed off to a real sales if any transfer targets a
  // non-queue user. When true, queue-account messages are ignored for timing.
  const transferredToRealSales = events.some((e) => !BITRIX_QUEUE_USER_IDS.has(e.toUserId));

  // Pass 2 — compute response samples.
  // Timestamp of the anchor an agent still owes a reply to. Two things set it:
  //   • an unanswered CUSTOMER message (self-select / front-desk pickup case), or
  //   • a TRANSFER/ASSIGN to a real sales — the handoff moment. A sales is
  //     measured from when the chat reached them, not from the customer's
  //     earlier wait, so a transfer RESETS the anchor to the handoff time.
  // ONLY transfer/assign-anchored replies are counted toward `samples`: a sales
  // who was HANDED the chat is measured from the handoff. An agent who SELF-
  // SELECTS a conversation (replies to a plain customer message with no handoff
  // to them — e.g. front-desk Fauzan picking a chat off the queue) produces NO
  // sample; picking a chat yourself isn't a measured "response time". `pendingIsTransfer`
  // tracks which kind of anchor is currently open. `hasPending` still reflects
  // EITHER kind, so the "Belum/Sudah Dibalas" status stays accurate even for
  // self-selected chats (a self-select reply still clears the pending anchor).
  let pendingAt: string | null = null;
  let pendingIsTransfer = false;

  for (const msg of sorted) {
    const sender = msg.senderid;

    if (sender === "0") {
      // Handoff to a real sales starts (resets) the clock. Generic queue
      // assignment ("semua agen dalam antrean" — no [USER]) and handoffs whose
      // target is a queue/bot account don't start a clock.
      const target = extractTransferTarget(msg.text);
      if (target && !BITRIX_QUEUE_USER_IDS.has(target)) {
        pendingAt = msg.date;
        pendingIsTransfer = true;
      }
      continue;
    }

    if (customerIds.has(sender)) {
      if (!pendingAt) {
        pendingAt = msg.date;
        pendingIsTransfer = false;
      }
      continue;
    }

    // Queue/bot account on a chat that a real sales later took over: ignore it
    // entirely — no sample, and the pending anchor survives so the real sales'
    // reply is what gets measured.
    if (transferredToRealSales && BITRIX_QUEUE_USER_IDS.has(sender)) continue;

    // Agent message — consume the anchor. Credit a sample ONLY when the anchor
    // was a transfer/assign handoff to this side; a self-selected pickup (customer-
    // message anchor, no handoff) clears the anchor without producing a sample.
    if (pendingAt) {
      if (pendingIsTransfer) {
        const seconds = diffSeconds(pendingAt, msg.date);
        if (seconds !== null && seconds >= 0) {
          samples.push({ userId: sender, seconds });
        }
      }
      pendingAt = null;
      pendingIsTransfer = false;
    }
  }

  return { samples, events, hasPending: pendingAt !== null };
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
