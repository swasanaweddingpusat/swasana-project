import QRCode from "qrcode";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

const FALLBACK_WIDTH = 720;
const FALLBACK_HEIGHT = 1160;
const CREAM = "#FAF7F2";
const INK = "#0F4159";
const MAX_CANVAS_DIMENSION = 1400;

/**
 * Resolve a festival background image key to a same-origin URL. Canvas pixel
 * reads (drawImage + toBlob) require the image to load via a CORS-safe path,
 * so this proxies through our own API instead of hitting the S3/MinIO public
 * URL directly (the bucket's CORS headers aren't something this repo controls).
 * Falls back to passing an already-full URL through as-is (legacy data) — the
 * caller's try/catch around loadImage still guards against that failing.
 */
function toProxyImageUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return `/api/guestbook/festival-image?key=${encodeURIComponent(key)}`;
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

/**
 * Draw the QR (plus its guest code below it) into a white rounded box at
 * (x, y, w, h). The code's line height is reserved out of the box height
 * BEFORE sizing the QR, so the QR shrinks to fit — the combined QR + code
 * never grows past the box the admin configured in Settings > Festival.
 */
function drawQrTicket(
  ctx: CanvasRenderingContext2D,
  qrImage: HTMLImageElement,
  code: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const inset = Math.min(14, Math.min(w, h) * 0.1);
  const radius = Math.min(18, Math.min(w, h) / 4);
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  const innerX = x + inset;
  const innerY = y + inset;
  const innerW = Math.max(0, w - inset * 2);
  const innerH = Math.max(0, h - inset * 2);

  const fontSize = Math.max(9, Math.min(16, innerW * 0.09));
  const textBlockH = code ? fontSize * 1.6 : 0;
  const qrSize = Math.max(0, Math.min(innerW, innerH - textBlockH));
  const qrX = innerX + (innerW - qrSize) / 2;
  ctx.drawImage(qrImage, qrX, innerY, qrSize, qrSize);

  if (code) {
    ctx.fillStyle = INK;
    ctx.font = `600 ${fontSize}px "Geist Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code, innerX + innerW / 2, innerY + qrSize + textBlockH / 2);
  }
}

/**
 * Render a shareable ticket PNG for a guestbook entry, for sharing to WhatsApp
 * via the Web Share API. The ticket is intentionally minimal: the festival's
 * CMS-uploaded background poster, full-bleed at its own natural aspect ratio
 * (no cropping), with the QR code + its guest code text placed into the
 * barcode box the admin configured on that same poster in Settings >
 * Festival. No other overlays are drawn — the poster + QR box is the whole
 * design.
 */
export async function generateGuestbookTicketBlob(
  entry: GuestbookEntryItem
): Promise<Blob | null> {
  if (typeof document === "undefined" || !entry.guestCode) return null;

  const qrDataUrl = await QRCode.toDataURL(entry.guestCode, {
    width: 480,
    margin: 1,
    color: { dark: INK, light: "#FFFFFF" },
  });
  const qrImage = await loadImage(qrDataUrl);

  // Festival background is CMS-uploaded — best-effort: a broken/unreachable
  // image must never block ticket generation, just fall back to a plain card.
  const bgUrl = toProxyImageUrl(entry.festival?.backgroundImageKey);
  let bgImage: HTMLImageElement | null = null;
  if (bgUrl) {
    try {
      bgImage = await loadImage(bgUrl, "anonymous");
    } catch (e) {
      console.error("[generateGuestbookTicketBlob] failed to load festival background", e);
    }
  }

  const canvas = document.createElement("canvas");
  const scale = 2;

  let canvasW: number;
  let canvasH: number;
  if (bgImage) {
    const longest = Math.max(bgImage.width, bgImage.height);
    const shrink = longest > MAX_CANVAS_DIMENSION ? MAX_CANVAS_DIMENSION / longest : 1;
    canvasW = Math.round(bgImage.width * shrink);
    canvasH = Math.round(bgImage.height * shrink);
  } else {
    canvasW = FALLBACK_WIDTH;
    canvasH = FALLBACK_HEIGHT;
  }

  canvas.width = canvasW * scale;
  canvas.height = canvasH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  if (bgImage) {
    // Full poster, drawn at its own aspect ratio — no cover-crop — so the
    // barcode box (dragged by the admin over this exact uncropped image)
    // lands at the same fraction-of-image position here.
    ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
  } else {
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Admin-configured barcode placement box (fractions of the uploaded image's
  // natural width/height, drawn in Settings > Festival). Maps 1:1 onto the
  // canvas since the background above is drawn unscaled-and-uncropped.
  const boxFracX = entry.festival?.barcodeBoxX;
  const boxFracY = entry.festival?.barcodeBoxY;
  const boxFracW = entry.festival?.barcodeBoxWidth;
  const boxFracH = entry.festival?.barcodeBoxHeight;
  const hasConfiguredBox =
    bgImage &&
    typeof boxFracX === "number" &&
    typeof boxFracY === "number" &&
    typeof boxFracW === "number" &&
    typeof boxFracH === "number";

  if (hasConfiguredBox) {
    drawQrTicket(
      ctx,
      qrImage,
      entry.guestCode,
      boxFracX * canvasW,
      boxFracY * canvasH,
      boxFracW * canvasW,
      boxFracH * canvasH
    );
  } else {
    // No box configured (or no background at all) — fall back to a centered
    // QR sized relative to the canvas so the ticket still works.
    const size = Math.min(canvasW, canvasH) * 0.36;
    drawQrTicket(ctx, qrImage, entry.guestCode, (canvasW - size) / 2, (canvasH - size) / 2, size, size);
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}
