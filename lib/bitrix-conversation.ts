export interface ParsedSubject {
  name: string;
  phone: string | null;
  venue: string | null;
  channel: string | null;
}

// Subject shape (Indonesian portal):
//   Obrolan Saluran Terbuka: "<name> (<handle>) - <VENUE>" (<channel label>)
// Handle is a phone for WA, a username for IG/TikTok. Venue + handle are
// optional; "Guest" sessions have just the quoted name.
export function parseSubject(subject: string | null): ParsedSubject {
  if (!subject) return { name: "Guest", phone: null, venue: null, channel: null };

  const quoted = subject.match(/"([^"]+)"/);
  const inner = quoted?.[1]?.trim() ?? subject.trim();

  // Trailing "(...)" after the quoted block is the human channel label.
  const channelMatch = subject.match(/\(([^()]*)\)\s*$/);
  const channel = channelMatch && quoted ? channelMatch[1].trim() : null;

  // Venue is the segment after the last " - ".
  let venue: string | null = null;
  let core = inner;
  const dashIdx = core.lastIndexOf(" - ");
  if (dashIdx !== -1) {
    venue = core.slice(dashIdx + 3).trim() || null;
    core = core.slice(0, dashIdx).trim();
  }

  // Handle inside "(...)" — a phone if mostly digits.
  let phone: string | null = null;
  const handleMatch = core.match(/\(([^)]*)\)\s*$/);
  if (handleMatch) {
    const handle = handleMatch[1].trim();
    if (/^\+?\d[\d\s-]{6,}$/.test(handle)) phone = handle;
    core = core.slice(0, handleMatch.index).trim();
  }

  const name = core || "Guest";
  return { name, phone, venue, channel };
}

// Fallback channel label when the subject carries no trailing "(...)".
export function channelFromSourceId(source: string | null): string {
  if (!source) return "-";
  if (/tiktok/i.test(source)) return "TikTok";
  if (/instagram|ig_|fbinstagram/i.test(source)) return "Instagram Direct";
  if (/whatsapp|_wa_|wazzup|1engage/i.test(source)) return "WhatsApp";
  if (/facebook|fb_|messenger/i.test(source)) return "Facebook Messenger";
  return source.replace(/askarasoft_conn_/i, "").replace(/_/g, " ").trim() || "-";
}
