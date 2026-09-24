import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

/**
 * Jembatan Pi SDK untuk fitur Chat AI.
 *
 * Kredensial diambil dari tabel `ai_provider_configs` (terenkripsi) — BUKAN dari
 * env — supaya bisa dikelola lewat Settings > AI Model, termasuk gateway 9router.
 *
 * Keamanan sesi chat:
 * - `tools: []` + `noTools: "all"` → model tidak bisa baca/tulis file atau jalanin shell.
 * - `SessionManager.inMemory()` → transkrip tidak ditulis ke disk server.
 * - resource loader tanpa extension/skill/prompt discovery → tidak ada kode project yang ikut termuat.
 */

const SYSTEM_PROMPT = [
  "Kamu adalah Swasana AI, asisten internal untuk karyawan Swasana",
  "(wedding & MICE venue / event organizer).",
  "Jawab dalam Bahasa Indonesia yang ringkas, sopan, dan langsung ke inti.",
  "Kamu tidak punya akses ke file, terminal, maupun database perusahaan.",
  "Kalau kamu tidak yakin atau butuh data internal, katakan terus terang",
  "dan sarankan modul aplikasi yang relevan.",
].join(" ");

/** Provider id internal untuk Pi — koneksi 9router didaftarkan terpisah per config. */
function providerIdFor(configId: string): string {
  return `swasana-ai-${configId}`;
}

export interface ResolvedAiProvider {
  id: string;
  name: string;
  modelId: string;
}

/** Ambil koneksi aktif berdasarkan id, atau koneksi default kalau id kosong. */
export async function resolveAiProviderConfig(configId?: string) {
  if (configId) {
    return db.aiProviderConfig.findFirst({ where: { id: configId, isActive: true } });
  }
  return db.aiProviderConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Model runtime yang sudah dikonfigurasi memakai credential dari DB. */
export async function createModelRuntimeForConfig(config: {
  id: string;
  kind: "anthropic" | "router9";
  baseUrl: string | null;
  authScheme: "api_key" | "bearer";
  credentialEnc: string;
  modelId: string;
}): Promise<{ runtime: ModelRuntime; providerId: string }> {
  const credential = decryptSecret(config.credentialEnc);

  // `refreshOnCreate: false` → jangan panggil katalog model lewat jaringan saat
  // request; model yang dipakai sudah ditentukan eksplisit di config.
  const runtime = await ModelRuntime.create({ modelsPath: null, refreshOnCreate: false });

  // Anthropic langsung dengan API key → cukup override runtime key provider bawaan.
  if (config.kind === "anthropic" && config.authScheme === "api_key" && !config.baseUrl) {
    await runtime.setRuntimeApiKey("anthropic", credential);
    return { runtime, providerId: "anthropic" };
  }

  // Selain itu (9router / endpoint kustom / bearer) daftarkan provider sendiri.
  // `authHeader: true` mengirim `Authorization: Bearer <credential>`, sesuai
  // gateway 9router; mode api_key memakai header `x-api-key` bawaan Anthropic.
  const providerId = providerIdFor(config.id);
  const baseModel = runtime.getModel("anthropic", config.modelId);

  runtime.registerProvider(providerId, {
    name: `Swasana AI (${config.kind})`,
    api: "anthropic-messages",
    baseUrl: config.baseUrl ?? "https://api.anthropic.com",
    apiKey: credential,
    authHeader: config.authScheme === "bearer",
    models: [
      {
        id: config.modelId,
        name: config.modelId,
        reasoning: baseModel?.reasoning ?? false,
        input: baseModel?.input ?? ["text"],
        cost: baseModel?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: baseModel?.contextWindow ?? 200000,
        maxTokens: baseModel?.maxTokens ?? 8192,
      },
    ],
  });

  return { runtime, providerId };
}

/** Resource loader minimal — tanpa discovery extension/skill/prompt/context file. */
function createIsolatedResourceLoader(): DefaultResourceLoader {
  return new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: process.cwd(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => SYSTEM_PROMPT,
    appendSystemPromptOverride: () => [],
  });
}

/** Buat sesi chat sekali pakai untuk satu request. */
export async function createChatSession(config: {
  id: string;
  kind: "anthropic" | "router9";
  baseUrl: string | null;
  authScheme: "api_key" | "bearer";
  credentialEnc: string;
  modelId: string;
}): Promise<AgentSession> {
  const { runtime, providerId } = await createModelRuntimeForConfig(config);

  const model = runtime.getModel(providerId, config.modelId);
  if (!model) {
    throw new Error(`Model "${config.modelId}" tidak tersedia pada koneksi ini.`);
  }

  const resourceLoader = createIsolatedResourceLoader();
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    model,
    modelRuntime: runtime,
    resourceLoader,
    thinkingLevel: "off",
    noTools: "all",
    tools: [],
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  });

  return session;
}
