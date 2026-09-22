import { z } from "zod";

/** Generic file descriptor for storage-key-based uploads — path is a storage
 * KEY, never a full URL. Shared across domains (guestbook, attendance, ...). */
export const fileDescriptorSchema = z.object({
  id: z.string().nullable().optional(),
  name_file_origin: z.string().nullable().optional(),
  mimetype: z.string().nullable().optional(),
  path: z.string(),
});

export type FileDescriptor = z.infer<typeof fileDescriptorSchema>;
