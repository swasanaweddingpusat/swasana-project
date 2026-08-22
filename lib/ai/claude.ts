import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude client, diarahkan ke gateway 9router (BYO key). Config dibaca dari env
 * yang SAMA dengan tooling CLI: `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`
 * (Bearer). Fallback ke `ANTHROPIC_API_KEY` (x-api-key) kalau itu yang dipakai.
 *
 * Server-only. Jangan import dari client component (env token tidak boleh bocor).
 */
let cachedClient: Anthropic | null = null;

function getClaudeClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!baseURL || (!authToken && !apiKey)) {
    throw new Error(
      "Claude (9router) belum dikonfigurasi: set ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN di env.",
    );
  }

  cachedClient = new Anthropic(
    authToken ? { baseURL, authToken } : { baseURL, apiKey: apiKey! },
  );
  return cachedClient;
}

/** Model buat baca dokumen. Override via env; default Sonnet 5. */
export const PO_EXTRACT_MODEL = process.env.PO_EXTRACT_MODEL ?? "claude-sonnet-5";

export interface PoExtractionResult {
  /** true kalau Claude menemukan nomor PO di dokumen. */
  found: boolean;
  /** Nomor PO persis seperti tertulis (tanpa normalisasi), atau null. */
  poNumber: string | null;
  /** Keyakinan model, 0..1. */
  confidence: number;
}

const EXTRACT_PROMPT = [
  "Dokumen ini adalah Purchase Order (PO) untuk sebuah booking wedding/event.",
  "Tugasmu: temukan NOMOR PO (Purchase Order Number) di dokumen.",
  "Nomor PO biasanya berformat seperti '001/BRAND/VENUE/JENISEVENT/dd-mm-yyyy'",
  "(contoh: 015/SWP/BALLROOM/WEDDING/21-08-2026), sering berada di kop/header",
  "atau dekat label 'No PO', 'Nomor PO', 'PO Number', atau 'Purchase Order'.",
  "Kembalikan nomor PO PERSIS seperti tertulis di dokumen — jangan diubah,",
  "jangan dinormalisasi, jangan ditebak. Jika tidak yakin atau tidak ada,",
  "set found=false dan poNumber kosong. confidence = seberapa yakin kamu (0..1).",
].join(" ");

/**
 * Baca 1 field — nomor PO — dari PDF pakai Claude vision. Ekstraksi saja;
 * KEPUTUSAN cocok/tidak tetap dilakukan di server pemanggil (deterministik,
 * auditable). Hasil ini cuma dipakai buat auto-fill + indikator, bukan gerbang.
 */
export async function extractPoNumberFromPdf(pdfBase64: string): Promise<PoExtractionResult> {
  const client = getClaudeClient();

  const message = await client.messages.create({
    model: PO_EXTRACT_MODEL,
    max_tokens: 512,
    tools: [
      {
        name: "report_po_number",
        description: "Laporkan nomor Purchase Order (PO) yang ditemukan di dokumen.",
        input_schema: {
          type: "object",
          properties: {
            found: { type: "boolean", description: "true jika nomor PO ditemukan di dokumen." },
            poNumber: { type: "string", description: "Nomor PO persis seperti tertulis. Kosongkan jika tidak ada." },
            confidence: { type: "number", description: "Keyakinan 0..1." },
          },
          required: ["found", "poNumber", "confidence"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_po_number" },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { found: false, poNumber: null, confidence: 0 };
  }

  const input = toolUse.input as { found?: boolean; poNumber?: string; confidence?: number };
  const poNumber = (input.poNumber ?? "").trim();
  const found = input.found === true && poNumber.length > 0;
  const confidenceRaw = typeof input.confidence === "number" ? input.confidence : 0;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));

  return {
    found,
    poNumber: found ? poNumber : null,
    confidence,
  };
}
