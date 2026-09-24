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

/** Compute the source crop rect (sx, sy, sw, sh) that `drawImageCover` reads from
 *  `img` so it fills a (w, h) box like CSS `object-fit: cover` — centered crop
 *  on whichever axis overflows. Shared by `drawImageCover` and `mapImageBoxToCanvas`
 *  so both use the exact same crop math. */
function computeCoverCropRect(
  img: HTMLImageElement,
  w: number,
  h: number
): { sx: number; sy: number; sw: number; sh: number } {
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
  return { sx, sy, sw, sh };
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
  const { sx, sy, sw, sh } = computeCoverCropRect(img, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Map a box expressed as fractions (0..1) of `img`'s natural width/height into
 *  the destination canvas coordinates it lands at once `img` has been drawn
 *  full-bleed into (destX, destY, destW, destH) via `drawImageCover`. Mirrors
 *  `computeCoverCropRect`'s crop rect, then applies the same crop→scale affine
 *  transform to the box corners. The box may partially (or fully) fall inside
 *  the cropped-out region of the source image, so the result is clamped to the
 *  destination rect. */
function mapImageBoxToCanvas(
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  fracX: number,
  fracY: number,
  fracW: number,
  fracH: number
): { x: number; y: number; width: number; height: number } {
  const { sx, sy, sw, sh } = computeCoverCropRect(img, destW, destH);
  const scaleX = destW / sw;
  const scaleY = destH / sh;

  // Box corners in natural image pixel coordinates.
  const boxX = fracX * img.width;
  const boxY = fracY * img.height;
  const boxX2 = boxX + fracW * img.width;
  const boxY2 = boxY + fracH * img.height;

  // Same crop→scale transform drawImageCover applies to the whole image,
  // applied here to the two corners of the box.
  let x1 = destX + (boxX - sx) * scaleX;
  let y1 = destY + (boxY - sy) * scaleY;
  let x2 = destX + (boxX2 - sx) * scaleX;
  let y2 = destY + (boxY2 - sy) * scaleY;

  // Clamp to the destination rect — the box may straddle or sit entirely
  // inside the cropped-out region of the source image.
  x1 = Math.max(destX, Math.min(x1, destX + destW));
  y1 = Math.max(destY, Math.min(y1, destY + destH));
  x2 = Math.max(destX, Math.min(x2, destX + destW));
  y2 = Math.max(destY, Math.min(y2, destY + destH));

  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
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

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = "#D8CFBC"): void {
  ctx.save();
  ctx.strokeStyle = color;
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

/** Draw a rounded pill auto-sized to fit `text`, centered at (centerX, centerY). Returns the pill's rendered width/height for layout. */
function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  opts: { font: string; textColor: string; bgColor: string; paddingX: number; paddingY: number }
): { width: number; height: number } {
  ctx.font = opts.font;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + opts.paddingX * 2;
  const height = opts.paddingY * 2 + 20;
  roundRect(ctx, centerX - width / 2, centerY - height / 2, width, height, height / 2);
  ctx.fillStyle = opts.bgColor;
  ctx.fill();
  ctx.fillStyle = opts.textColor;
  ctx.textBaseline = "middle";
  ctx.fillText(text, centerX, centerY + 1);
  ctx.textBaseline = "alphabetic";
  return { width, height };
}

/** Translucent rounded cream backdrop drawn behind a piece of text so it stays
 *  legible when the background is full-bleed festival artwork rather than the
 *  plain cream card. Sized/positioned by the caller (centered at centerX/centerY). */
function drawTextBackdrop(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  radius: number
): void {
  roundRect(ctx, centerX - width / 2, centerY - height / 2, width, height, radius);
  ctx.fillStyle = "rgba(250,247,242,0.94)";
  ctx.fill();
}

/** Small decorative gold dot accent (festive flourish next to badges). */
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
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

  // Admin-configured barcode placement box (fractions of the uploaded image's
  // natural width/height, drawn in Settings > Festival). Only usable once the
  // background image actually loaded and all four fractions are present.
  const boxFracX = entry.festival?.barcodeBoxX;
  const boxFracY = entry.festival?.barcodeBoxY;
  const boxFracW = entry.festival?.barcodeBoxWidth;
  const boxFracH = entry.festival?.barcodeBoxHeight;

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
  const centerX = TICKET_WIDTH / 2;
  roundRect(ctx, pad, pad, cardW, TICKET_HEIGHT - pad * 2, 32);
  ctx.fillStyle = CREAM;
  ctx.fill();

  // Background layer (clipped to the card's rounded corners). With festival
  // artwork available, it's drawn full-bleed across the ENTIRE card so the
  // whole poster stays visible (needed so an admin-configured barcode box
  // anywhere in the image lands somewhere real) — otherwise a warm
  // gold-to-cream wash stands in for the artwork.
  const heroHeight = hasBg ? 340 : 200;
  const cardH = TICKET_HEIGHT - pad * 2;
  ctx.save();
  roundRect(ctx, pad, pad, cardW, cardH, 32);
  ctx.clip();
  if (hasBg && bgImage) {
    drawImageCover(ctx, bgImage, pad, pad, cardW, cardH);
  } else {
    const wash = ctx.createLinearGradient(0, pad, 0, pad + heroHeight);
    wash.addColorStop(0, "rgba(212,165,71,0.35)");
    wash.addColorStop(1, CREAM);
    ctx.fillStyle = wash;
    ctx.fillRect(pad, pad, cardW, heroHeight);
  }
  ctx.restore();

  // Auto-place the QR into the admin-configured barcode box, mapped from
  // image-fraction coordinates through the same crop-to-fill math used to
  // draw the background above. Falls back to the footer's fixed QR slot
  // (drawn later) when no box is configured or it crops out entirely.
  let mappedQrBox: { x: number; y: number; width: number; height: number } | null = null;
  if (
    hasBg &&
    bgImage &&
    typeof boxFracX === "number" &&
    typeof boxFracY === "number" &&
    typeof boxFracW === "number" &&
    typeof boxFracH === "number"
  ) {
    const candidate = mapImageBoxToCanvas(
      bgImage,
      pad,
      pad,
      cardW,
      cardH,
      boxFracX,
      boxFracY,
      boxFracW,
      boxFracH
    );
    if (candidate.width >= 24 && candidate.height >= 24) {
      mappedQrBox = candidate;
    }
  }
  if (mappedQrBox) {
    const inset = Math.min(14, Math.min(mappedQrBox.width, mappedQrBox.height) * 0.12);
    const radius = Math.min(18, Math.min(mappedQrBox.width, mappedQrBox.height) / 4);
    roundRect(ctx, mappedQrBox.x, mappedQrBox.y, mappedQrBox.width, mappedQrBox.height, radius);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.drawImage(
      qrImage,
      mappedQrBox.x + inset,
      mappedQrBox.y + inset,
      Math.max(0, mappedQrBox.width - inset * 2),
      Math.max(0, mappedQrBox.height - inset * 2)
    );
  }

  // Brand wordmark pill — solid cream chip so it stays legible over any
  // uploaded artwork, flanked by small gold accent dots for a festive touch.
  const wordmarkY = pad + 48;
  ctx.font = `600 22px ${logoFont}`;
  const wordmarkPill = drawPill(ctx, "SWASANA", centerX, wordmarkY, {
    font: `600 22px ${logoFont}`,
    textColor: GOLD,
    bgColor: CREAM,
    paddingX: 22,
    paddingY: 8,
  });
  drawDot(ctx, centerX - wordmarkPill.width / 2 - 16, wordmarkY, 4, GOLD);
  drawDot(ctx, centerX + wordmarkPill.width / 2 + 16, wordmarkY, 4, GOLD);

  // Gold badge pill — attendance-ticket label, echoing the poster's category badge.
  const badgeY = wordmarkY + 48;
  drawPill(ctx, "TIKET KEHADIRAN", centerX, badgeY, {
    font: `700 15px ${bodyFont}`,
    textColor: INK,
    bgColor: GOLD,
    paddingX: 20,
    paddingY: 9,
  });

  // Big bold festival title, sitting just below the hero. With full-bleed
  // artwork behind it, a translucent cream backdrop keeps it legible over
  // arbitrary background art (the plain-cream fallback needs no backdrop).
  let y = pad + heroHeight + 52;
  ctx.font = `800 34px ${headingFont}`;
  const title = entry.festival?.name?.trim() || "Tiket Kehadiran Expo";
  const titleText = truncate(ctx, title, cardW - 80);
  if (hasBg) {
    const titleWidth = ctx.measureText(titleText).width;
    drawTextBackdrop(ctx, centerX, y - 10, titleWidth + 48, 54, 16);
  }
  ctx.fillStyle = INK;
  ctx.fillText(titleText, centerX, y);

  // Festival "keterangan" — CMS-editable caption, shown as a dark callout pill.
  if (entry.festival?.description) {
    y += 40;
    const pillWidth = cardW - 96;
    const pillHeight = 48;
    roundRect(ctx, centerX - pillWidth / 2, y - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.font = `600 16px ${bodyFont}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(ctx, entry.festival.description, pillWidth - 48), centerX, y + 1);
    ctx.textBaseline = "alphabetic";
    y += pillHeight / 2 + 30;
  } else {
    y += 20;
  }

  // Visitor info block — same translucent backdrop treatment as the title
  // when sitting over full-bleed artwork, sized to hug the name/company lines.
  if (hasBg) {
    ctx.font = `700 26px ${bodyFont}`;
    const nameWidth = ctx.measureText(truncate(ctx, entry.visitorName, cardW - 80)).width;
    let panelWidth = nameWidth;
    let panelHeight = 36;
    let panelCenterY = y - 8;
    if (entry.companyName) {
      ctx.font = `400 16px ${bodyFont}`;
      const companyWidth = ctx.measureText(truncate(ctx, entry.companyName, cardW - 80)).width;
      panelWidth = Math.max(nameWidth, companyWidth);
      panelHeight = 66;
      panelCenterY = y + 7;
    }
    drawTextBackdrop(ctx, centerX, panelCenterY, panelWidth + 48, panelHeight, 18);
  }

  ctx.fillStyle = INK;
  ctx.font = `700 26px ${bodyFont}`;
  ctx.fillText(truncate(ctx, entry.visitorName, cardW - 80), centerX, y);

  if (entry.companyName) {
    y += 28;
    ctx.font = `400 16px ${bodyFont}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(truncate(ctx, entry.companyName, cardW - 80), centerX, y);
  }

  y += 40;
  drawDashedLine(ctx, pad + 24, y, TICKET_WIDTH - pad - 24);
  y += 36;

  // Dark footer card — mirrors the reference poster's ticket stub: a bold
  // "E-TICKET" pill + guest code on the left, the QR/barcode in a white
  // rounded box on the right. That white QR box is only drawn here as a
  // FALLBACK — when the admin configured a barcode box on the artwork, the
  // QR was already drawn into that mapped position above instead.
  const footerX = pad + 16;
  const footerW = cardW - 32;
  const footerH = 216;
  roundRect(ctx, footerX, y, footerW, footerH, 24);
  ctx.fillStyle = INK;
  ctx.fill();

  const qrBoxSize = 168;
  const qrBoxX = footerX + footerW - qrBoxSize - 24;
  const qrBoxY = y + (footerH - qrBoxSize) / 2;
  if (!mappedQrBox) {
    roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    const qrInset = 14;
    ctx.drawImage(
      qrImage,
      qrBoxX + qrInset,
      qrBoxY + qrInset,
      qrBoxSize - qrInset * 2,
      qrBoxSize - qrInset * 2
    );
  }

  const leftColX = footerX + 32;
  ctx.textAlign = "left";
  const leftColCenterY = y + footerH / 2;
  // drawPill only supports center-anchored positioning; this column needs a
  // left-aligned pill, so it's drawn manually here instead.
  ctx.font = `700 13px ${bodyFont}`;
  const eTicketWidth = ctx.measureText("E-TICKET").width + 28;
  roundRect(ctx, leftColX, leftColCenterY - 44 - 17, eTicketWidth, 34, 17);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText("E-TICKET", leftColX + 14, leftColCenterY - 43);
  ctx.textBaseline = "alphabetic";

  ctx.font = `600 22px ${monoFont}`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(entry.guestCode, leftColX, leftColCenterY + 4);

  ctx.font = `400 14px ${bodyFont}`;
  ctx.fillStyle = "#C9D3D8";
  // When the QR moved into a mapped box, the footer's fixed slot is empty —
  // let the caption use the full remaining footer width instead of stopping
  // short at the (now unused) qrBoxX.
  const tagWidth = mappedQrBox ? footerX + footerW - 24 - leftColX : qrBoxX - leftColX - 24;
  wrapText(ctx, "Tunjukkan QR code ini kepada panitia saat check-in.", leftColX, leftColCenterY + 32, tagWidth, 19);

  ctx.textAlign = "center";

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}
