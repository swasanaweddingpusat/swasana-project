import QRCode from "qrcode";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

const TICKET_WIDTH = 720;
const TICKET_HEIGHT = 1160;
const PAGE_BG = "#E8E2D6";
const INK = "#0F4159";
const GOLD = "#D4A547";
const CREAM = "#FAF7F2";
const MUTED = "#5B6B73";

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";

function toFullUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : key;
}

function resolveFontFamily(cssVar: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function loadImage(src: string, crossOrigin?: "anonymous"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw `img` into the (x, y, w, h) box, cropping to fill (like CSS `object-fit: cover`). */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number): void {
  ctx.save();
  ctx.strokeStyle = "#D8CFBC";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, centerX, y);
}

/** Render a shareable ticket-style PNG (QR + visitor info) for a guestbook entry, for sharing to WhatsApp via the Web Share API. */
export async function generateGuestbookTicketBlob(
  entry: GuestbookEntryItem
): Promise<Blob | null> {
  if (typeof document === "undefined" || !entry.guestCode) return null;

  await document.fonts?.ready?.catch(() => {});
  const headingFont = resolveFontFamily("--font-heading", "Georgia, serif");
  const logoFont = resolveFontFamily("--font-logo", "sans-serif");
  const bodyFont = resolveFontFamily("--font-sans", "system-ui, sans-serif");
  const monoFont = resolveFontFamily("--font-mono", "monospace");

  const qrDataUrl = await QRCode.toDataURL(entry.guestCode, {
    width: 480,
    margin: 1,
    color: { dark: INK, light: "#FFFFFF" },
  });
  const qrImage = await loadImage(qrDataUrl);

  // Festival background is CMS-uploaded — best-effort: a broken/unreachable
  // image must never block ticket generation, just fall back to the plain header.
  const bgUrl = toFullUrl(entry.festival?.backgroundImageKey);
  let bgImage: HTMLImageElement | null = null;
  if (bgUrl) {
    try {
      bgImage = await loadImage(bgUrl, "anonymous");
    } catch (e) {
      console.error("[generateGuestbookTicketBlob] failed to load festival background", e);
    }
  }
  const hasBg = Boolean(bgImage);

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = TICKET_WIDTH * scale;
  canvas.height = TICKET_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.textAlign = "center";

  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, TICKET_WIDTH, TICKET_HEIGHT);

  const pad = 32;
  const cardW = TICKET_WIDTH - pad * 2;
  roundRect(ctx, pad, pad, cardW, TICKET_HEIGHT - pad * 2, 32);
  ctx.fillStyle = CREAM;
  ctx.fill();

  // Header band (clipped to the card's rounded top corners). Uses the
  // festival's uploaded background image when available, cropped to fill and
  // darkened with a gradient so the logo/name stay legible over any artwork —
  // otherwise falls back to the original solid ink band.
  const bandHeight = hasBg ? 260 : 160;
  ctx.save();
  roundRect(ctx, pad, pad, cardW, TICKET_HEIGHT - pad * 2, 32);
  ctx.clip();
  if (hasBg && bgImage) {
    drawImageCover(ctx, bgImage, pad, pad, cardW, bandHeight);
    const gradient = ctx.createLinearGradient(0, pad, 0, pad + bandHeight);
    gradient.addColorStop(0, "rgba(15,65,89,0.25)");
    gradient.addColorStop(1, "rgba(15,65,89,0.85)");
    ctx.fillStyle = gradient;
    ctx.fillRect(pad, pad, cardW, bandHeight);
  } else {
    ctx.fillStyle = INK;
    ctx.fillRect(pad, pad, cardW, bandHeight);
  }
  ctx.restore();

  ctx.fillStyle = GOLD;
  ctx.font = `600 32px ${logoFont}`;
  ctx.fillText("SWASANA", TICKET_WIDTH / 2, pad + 66);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `500 18px ${bodyFont}`;
  const subtitle = entry.festival?.name?.trim() || "Tiket Kehadiran Expo";
  ctx.fillText(truncate(ctx, subtitle, cardW - 80), TICKET_WIDTH / 2, pad + 102);

  let y = pad + bandHeight + 56;
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${headingFont}`;
  ctx.fillText(truncate(ctx, entry.visitorName, cardW - 80), TICKET_WIDTH / 2, y);

  if (entry.companyName) {
    y += 32;
    ctx.font = `400 18px ${bodyFont}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(truncate(ctx, entry.companyName, cardW - 80), TICKET_WIDTH / 2, y);
  }

  // Festival "keterangan" — CMS-editable caption, replaceable per festival.
  if (entry.festival?.description) {
    y += 30;
    ctx.font = `400 15px ${bodyFont}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(truncate(ctx, entry.festival.description, cardW - 100), TICKET_WIDTH / 2, y);
  }

  y += 48;
  drawDashedLine(ctx, pad + 24, y, TICKET_WIDTH - pad - 24);

  const qrSize = 320;
  const qrX = (TICKET_WIDTH - qrSize) / 2;
  const qrY = y + 40;
  roundRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E5DDCB";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const codeY = qrY + qrSize + 56;
  ctx.font = `600 22px ${monoFont}`;
  ctx.fillStyle = INK;
  ctx.fillText(entry.guestCode, TICKET_WIDTH / 2, codeY);

  const footerDividerY = codeY + 40;
  drawDashedLine(ctx, pad + 24, footerDividerY, TICKET_WIDTH - pad - 24);

  ctx.font = `400 16px ${bodyFont}`;
  ctx.fillStyle = MUTED;
  wrapText(
    ctx,
    "Tunjukkan QR code ini kepada panitia saat check-in expo.",
    TICKET_WIDTH / 2,
    footerDividerY + 40,
    cardW - 80,
    22
  );

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}
