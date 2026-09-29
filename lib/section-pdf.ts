/**
 * Unduh satu elemen DOM (biasanya satu kartu/section dashboard) menjadi PDF.
 *
 * Dipakai tombol "Download PDF" per section di /bitrix24/overview.
 *
 * jsPDF + html2canvas di-import dinamis supaya bundle-nya tidak ikut terbawa di
 * initial load halaman overview.
 */

/** Margin tetap di sekeliling konten, dalam milimeter. */
const MARGIN_MM = 8;
const PX_TO_MM = 25.4 / 96;
/** Skala rasterisasi — 2x supaya teks tetap tajam di PDF. */
const RASTER_SCALE = 2;

/**
 * html2canvas 1.4.1 hanya mengenal dua fungsi warna: `rgb()` dan `hsl()`
 * (lihat SUPPORTED_COLOR_FUNCTIONS di dist-nya). Apa pun selain itu melempar
 * `Attempting to parse an unsupported color function`.
 *
 * Masalahnya, Tailwind v4 menulis palet dengan `oklch()` dan menyusun
 * opacity-modifier (`ring-foreground/10`, `bg-accent/50`) menjadi
 * `color-mix(in oklab, …)`. Browser me-resolve itu di computed style menjadi
 * `lab()` / `oklab()` — bukan `rgb()` — sehingga rasterisasi selalu gagal.
 *
 * Menimpa CSS variable saja TIDAK menolong: nilai yang dibaca html2canvas
 * berasal dari computed style yang sudah ter-resolve, bukan dari variable-nya.
 *
 * Jalan keluar yang benar: konversi setiap nilai warna menjadi `rgb()` lewat
 * browser itu sendiri. Canvas 2D menerima format warna apa pun yang dipahami
 * CSS dan mengembalikannya sebagai rgb/rgba — jadi ia dipakai sebagai mesin
 * konversi, alih-alih menebak padanan warna secara manual.
 */
const COLOR_FN = /\b(?:oklch|oklab|lab|lch|color-mix|color)\(/i;

/** Canvas sekali pakai sebagai pengurai warna; dibuat malas, lalu dipakai ulang. */
let parseCtx: CanvasRenderingContext2D | null = null;

function toRgb(value: string): string | null {
  if (!parseCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    parseCtx = c.getContext("2d");
  }
  if (!parseCtx) return null;
  try {
    // fillStyle menormalkan warna apa pun yang dipahami browser menjadi
    // "#rrggbb" atau "rgba(...)". Nilai yang tidak valid diabaikan browser,
    // sehingga fillStyle tetap berisi nilai sebelumnya — karena itu direset
    // ke sentinel dulu untuk mendeteksi kegagalan.
    parseCtx.fillStyle = "#000000";
    parseCtx.fillStyle = value;
    const normalized = parseCtx.fillStyle;
    if (typeof normalized !== "string") return null;
    if (normalized === "#000000" && !/^(#0{6}|black|rgba?\(0, ?0, ?0)/i.test(value.trim())) {
      // Konversi gagal diam-diam — biarkan pemanggil memakai fallback.
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Ubah semua fungsi warna modern di dalam satu nilai CSS menjadi `rgb()`.
 *
 * Nilai seperti `box-shadow` atau `background-image` bisa memuat lebih dari
 * satu warna beserta angka lain, jadi yang diganti hanya potongan fungsi
 * warnanya — dengan penelusuran kurung berpasangan, karena `color-mix` boleh
 * bersarang.
 */
function normalizeColorFunctions(value: string): string {
  if (!COLOR_FN.test(value)) return value;

  let out = "";
  let i = 0;
  while (i < value.length) {
    COLOR_FN.lastIndex = 0;
    const rest = value.slice(i);
    const m = rest.match(COLOR_FN);
    if (!m || m.index === undefined) {
      out += rest;
      break;
    }
    out += rest.slice(0, m.index);

    // Telusuri sampai kurung penutup yang berpasangan.
    let depth = 0;
    let j = m.index;
    for (; j < rest.length; j++) {
      if (rest[j] === "(") depth++;
      else if (rest[j] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const fnText = rest.slice(m.index, j + 1);
    out += toRgb(fnText) ?? "rgb(127, 127, 127)";
    i += j + 1;
  }
  return out;
}

/** Properti yang nilainya bisa memuat warna. */
const COLOR_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "fill",
  "stroke",
] as const;

/**
 * Tulis ulang setiap properti berwarna pada dokumen clone menjadi `rgb()`.
 *
 * Dijalankan pada clone, jadi tampilan di layar tidak tersentuh. Pseudo-element
 * tidak bisa di-set lewat `element.style`, sehingga ditangani terpisah lewat
 * satu blok <style> yang mematikan sumber warna modern di sana.
 */
function sanitize(root: HTMLElement, win: Window): void {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of elements) {
    const cs = win.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || !COLOR_FN.test(raw)) continue;
      el.style.setProperty(prop, normalizeColorFunctions(raw), "important");
    }
  }
}

/** Ubah nama section menjadi nama file yang aman lintas OS. */
function toFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || "section"}-${stamp}.pdf`;
}

/**
 * Render `element` ke sebuah PDF satu halaman dan langsung unduh.
 *
 * Ukuran halaman mengikuti proporsi elemen (bukan A4 tetap) agar kartu yang
 * lebar tidak terpotong dan kartu yang panjang tidak terbelah dua halaman —
 * untuk dashboard, keutuhan satu kartu lebih penting daripada ukuran kertas
 * standar. Melempar bila rasterisasi gagal; pemanggil yang menampilkan notifikasi.
 */
export async function downloadElementAsPdf(element: HTMLElement, title: string): Promise<void> {
  const [html2canvasMod, jsPdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const html2canvas = html2canvasMod.default;
  const { jsPDF } = jsPdfMod;

  const canvas = await html2canvas(element, {
    scale: RASTER_SCALE,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: element.scrollWidth,
    height: element.scrollHeight,
    scrollX: 0,
    scrollY: 0,
    windowWidth: document.documentElement.scrollWidth,
    onclone: (doc: Document, cloned: HTMLElement) => {
      // Pseudo-element dan sisa aturan global: matikan bayangan/ring yang
      // sumber warnanya color-mix, karena keduanya tidak menambah informasi
      // pada dokumen cetak dan tidak bisa dijangkau element.style.
      const style = doc.createElement("style");
      style.textContent = `
        *, *::before, *::after {
          box-shadow: none !important;
          text-shadow: none !important;
        }
        [data-pdf-hide] { display: none !important; }
      `;
      doc.head.appendChild(style);
      sanitize(cloned, doc.defaultView ?? window);
    },
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Hasil rasterisasi kosong.");
  }

  const contentWidthMm = (canvas.width / RASTER_SCALE) * PX_TO_MM;
  const contentHeightMm = (canvas.height / RASTER_SCALE) * PX_TO_MM;
  const pageWidthMm = contentWidthMm + MARGIN_MM * 2;
  const pageHeightMm = contentHeightMm + MARGIN_MM * 2;

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWidthMm, pageHeightMm],
    orientation: pageWidthMm >= pageHeightMm ? "landscape" : "portrait",
  });

  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    MARGIN_MM,
    MARGIN_MM,
    contentWidthMm,
    contentHeightMm,
  );
  doc.save(toFileName(title));
}
