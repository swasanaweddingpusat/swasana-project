const STAGING_BASE = {
  auth: "https://backendservicestg.e-meterai.co.id",
  stamp: "https://stampv2stg.e-meterai.co.id",
};

const PRODUCTION_BASE = {
  auth: "https://backendservice.e-meterai.co.id",
  stamp: "https://stampv2.e-meterai.co.id",
};

function getBase() {
  return process.env.PERURI_ENV === "production" ? PRODUCTION_BASE : STAGING_BASE;
}

// ─── JWT Cache ────────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getPeruriToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(`${getBase().auth}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: process.env.PERURI_USERNAME,
      password: process.env.PERURI_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`Peruri login HTTP ${res.status}`);

  const data = (await res.json()) as { statusCode: string; token?: string; message?: string };

  if (data.statusCode !== "00" || !data.token) {
    throw new Error(`Peruri login failed: ${data.message ?? data.statusCode}`);
  }

  cachedToken = data.token;
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

  return cachedToken;
}

export function clearPeruriTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ─── Generate Serial Number ───────────────────────────────────────────────────

export interface EmateraiResult {
  sn: string;
  qrBase64: string;
}

interface GenerateSnResponse {
  statusCode: string;
  message?: string;
  result?: { sn: string; image: string };
}

async function callGenerateSn(token: string, poNumber: string, bookingDate: Date): Promise<EmateraiResult> {
  const tgldoc = bookingDate.toISOString().split("T")[0];

  const res = await fetch(`${getBase().stamp}/chanel/stampv2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      isUpload: false,
      namadoc: "3",
      namafile: `PO-${poNumber}.pdf`,
      nodoc: poNumber,
      tgldoc,
      snOnly: false,
    }),
  });

  if (!res.ok) throw new Error(`Peruri generate SN HTTP ${res.status}`);

  const data = (await res.json()) as GenerateSnResponse;

  if (data.statusCode === "93") throw new Error("Kuota e-meterai tidak mencukupi. Hubungi administrator.");
  if (data.statusCode !== "00") throw new Error(`Peruri generate SN gagal: ${data.message ?? data.statusCode}`);
  if (!data.result?.sn || !data.result?.image) throw new Error("Peruri generate SN: response tidak valid");

  return { sn: data.result.sn, qrBase64: data.result.image };
}

export async function generateEmaterai(poNumber: string, bookingDate: Date): Promise<EmateraiResult> {
  const token = await getPeruriToken();

  try {
    return await callGenerateSn(token, poNumber, bookingDate);
  } catch (err) {
    if (err instanceof Error && err.message.includes("01")) {
      clearPeruriTokenCache();
      const freshToken = await getPeruriToken();
      return await callGenerateSn(freshToken, poNumber, bookingDate);
    }
    throw err;
  }
}
