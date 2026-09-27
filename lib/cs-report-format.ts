// Renders the CS division's daily incoming-chat summary as the exact WhatsApp
// text CS has historically typed by hand — same labels, spacing, and section
// order, so the generated message is a drop-in replacement for the manual one.

export interface CsReportBucket {
  key: string;
  label: string;
  count: number;
}

export interface CsReportAdBucket {
  key: string;
  url: string;
  count: number;
}

export interface CsReportData {
  /** ISO day the report covers, e.g. "2026-09-24" (usually yesterday). */
  date: string;
  totalChatMasuk: number;
  chatJadiDatabase: number;
  databaseRespon: number;
  databaseNoRespon: number;
  spamPrank: number;
  /** Ad URLs behind deals flagged Spam/Prank, most-hit first. */
  adsSpam: CsReportAdBucket[];
  /** Spam/Prank deals with no ad URL attached. */
  organikSpam: number;
  /** Incoming-chat channel breakdown ("WA - KEDIAMAN", "TikTok DM - ...", dst), most-hit first. */
  sources: CsReportBucket[];
}

export function formatCsReportWhatsApp(data: CsReportData, now: Date = new Date()): string {
  const lines: string[] = [];

  lines.push(`Assalamualaikum Selamat ${getGreeting(now)},`);
  lines.push(`Berikut Report Chat Masuk Kemarin ${formatIndonesianDate(data.date)}`);
  lines.push("");
  lines.push(`Total Chat Masuk : ${data.totalChatMasuk}`);
  lines.push(`Chat Jadi Database : ${data.chatJadiDatabase}`);
  lines.push(`Database Respon : ${data.databaseRespon}`);
  lines.push(`Database No Respon : ${data.databaseNoRespon}`);
  lines.push(`Spam/Prank : ${data.spamPrank}`);
  lines.push("");
  lines.push("Sumber Iklan Spam");
  for (const ad of data.adsSpam) lines.push(`${ad.url}  :  ${ad.count}`);
  lines.push(`Organik : ${data.organikSpam}`);
  lines.push("");
  lines.push("");
  lines.push("Sumber Chat Masuk");
  for (const s of data.sources) lines.push(`${s.label}  :  ${s.count}`);
  lines.push("");
  lines.push(`TOTAL CHAT MASUK : ${data.totalChatMasuk}`);

  return lines.join("\n");
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function getGreeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Jakarta",
    }).format(now),
  );
  if (hour >= 4 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
}

// isoDay is a Jakarta calendar day already (from UF_DB_DATE / CREATED bare
// date) — anchor at UTC noon so formatting in Asia/Jakarta never rolls to the
// adjacent day.
function formatIndonesianDate(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
