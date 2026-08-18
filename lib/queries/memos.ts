import { db } from "@/lib/db";

export async function getMemos() {
  return db.memo.findMany({
    select: {
      id: true,
      noMemo: true,
      judul: true,
      perihal: true,
      status: true,
      createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type MemoItem = Awaited<ReturnType<typeof getMemos>>[number];

export async function getMemoById(id: string) {
  return db.memo.findUnique({
    where: { id },
    select: {
      id: true,
      noMemo: true,
      judul: true,
      perihal: true,
      ruangLingkup: true,
      kepada: true,
      tembusan: true,
      jenisInformasi: true,
      klasifikasi: true,
      yangMenyetujui: true,
      yangMengetahui: true,
      isiMemo: true,
      status: true,
      venueId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, fullName: true } },
      venue: { select: { id: true, name: true } },
      comments: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              fullName: true,
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      readers: {
        select: {
          id: true,
          seenAt: true,
          reader: {
            select: {
              id: true,
              fullName: true,
              role: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { readers: true } },
    },
  });
}

export type MemoDetail = Awaited<ReturnType<typeof getMemoById>>;
