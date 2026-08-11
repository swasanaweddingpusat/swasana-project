// Pure string/number helpers shared by POPdfDocument (V1) and POPdfDocumentV2.
// No JSX, no @react-pdf/renderer import — keeps these unit-testable under vitest (node env).

export function fmtRp(n: number | bigint | null | undefined): string {
  if (n == null) return "";
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

// Decode HTML entities WITHOUT stripping tags or trimming whitespace. Used on the
// plain-text render branches (parseRichText, bold header rows) where the source data
// may contain a stray entity like "&amp;" but no tags — stripHtml would trim the
// intentional indent on vendor sub-lines, so we keep a trim-free variant here.
export function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

export function terbilang(n: number): string {
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + " Belas";
  if (n < 100) return satuan[Math.floor(n / 10)] + " Puluh" + (n % 10 ? " " + satuan[n % 10] : "");
  if (n < 200) return "Seratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 1000) return satuan[Math.floor(n / 100)] + " Ratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 2000) return "Seribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " Ribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + " Juta" + (n % 1000000 ? " " + terbilang(n % 1000000) : "");
  return terbilang(Math.floor(n / 1000000000)) + " Miliar" + (n % 1000000000 ? " " + terbilang(n % 1000000000) : "");
}

export function fmtRpTerbilang(amount: number): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")},-  (${terbilang(amount)} Rupiah)`;
}
