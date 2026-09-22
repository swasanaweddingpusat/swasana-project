import type { FileDescriptor } from "@/lib/validations/common";

export function resolveAttendancePhotoUrl(descriptor: FileDescriptor | null | undefined): string | null {
  if (!descriptor?.path) return null;
  if (descriptor.path.startsWith("http")) return descriptor.path;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${descriptor.path}`;
}
