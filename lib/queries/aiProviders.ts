import { db } from "@/lib/db";
import type { AiAuthScheme, AiProviderKind } from "@prisma/client";

/**
 * Bentuk aman koneksi AI untuk UI — TANPA `credentialEnc`. Kolom credential
 * sengaja tidak pernah di-select di sini supaya token tidak bisa bocor ke
 * client lewat props/serialization.
 */
export interface AiProviderItem {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  authScheme: AiAuthScheme;
  modelId: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
}

const SAFE_SELECT = {
  id: true,
  name: true,
  kind: true,
  baseUrl: true,
  authScheme: true,
  modelId: true,
  isActive: true,
  isDefault: true,
  sortOrder: true,
  lastTestedAt: true,
  lastTestOk: true,
} as const;

/** Semua koneksi (aktif + nonaktif) untuk halaman Settings > AI Model. */
export async function getAiProviders(): Promise<AiProviderItem[]> {
  return db.aiProviderConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: SAFE_SELECT,
    take: 100,
  });
}

/** Koneksi aktif saja — sumber daftar model di selector Chat AI. */
export async function getActiveAiProviders(): Promise<AiProviderItem[]> {
  return db.aiProviderConfig.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: SAFE_SELECT,
    take: 50,
  });
}
