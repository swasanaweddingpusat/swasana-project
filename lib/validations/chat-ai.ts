import { z } from "zod";

/** Satu giliran percakapan yang dikirim client sebagai konteks. */
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
});

export const chatAiRequestSchema = z.object({
  /** Id koneksi AI (AiProviderConfig). Kosong = pakai koneksi default. */
  providerId: z.string().max(100).optional(),
  message: z.string().trim().min(1, "Pesan tidak boleh kosong").max(8000),
  /** Riwayat sebelumnya, dibatasi agar payload dan biaya token tetap terkendali. */
  history: z.array(chatMessageSchema).max(20).default([]),
});

export type ChatAiRequest = z.infer<typeof chatAiRequestSchema>;
