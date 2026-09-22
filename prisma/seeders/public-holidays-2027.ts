import { prisma } from "./_client";

// Hari libur nasional Indonesia 2027 (18 tanggal merah) — sesuai SKB 3 Menteri
// No. 1205/2026, 3/2026, 2/2026 (ditandatangani 15 September 2026).
// Cuti bersama TIDAK dimasukkan — hanya libur nasional (tanggal merah).
// Catatan: Isra Mikraj muncul dua kali di 2027 (1448 H pada 5 Jan, 1449 H pada 26 Des),
// dan Idulfitri 1448 H dua hari (10-11 Maret) — masing-masing tanggal berbeda & unik.
const HOLIDAYS_2027: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "Tahun Baru 2027 Masehi" },
  { month: 1, day: 5, name: "Isra Mikraj Nabi Muhammad SAW 1448 Hijriah" },
  { month: 2, day: 6, name: "Tahun Baru Imlek 2578 Kongzili" },
  { month: 3, day: 8, name: "Hari Suci Nyepi Tahun Baru Saka 1949" },
  { month: 3, day: 10, name: "Hari Raya Idulfitri 1448 Hijriah" },
  { month: 3, day: 11, name: "Hari Raya Idulfitri 1448 Hijriah" },
  { month: 3, day: 26, name: "Wafat Yesus Kristus" },
  { month: 3, day: 28, name: "Kebangkitan Yesus Kristus (Paskah)" },
  { month: 5, day: 1, name: "Hari Buruh Internasional" },
  { month: 5, day: 6, name: "Kenaikan Yesus Kristus" },
  { month: 5, day: 17, name: "Hari Raya Iduladha 1448 Hijriah" },
  { month: 5, day: 20, name: "Hari Raya Waisak 2571 BE" },
  { month: 6, day: 1, name: "Hari Lahir Pancasila" },
  { month: 6, day: 6, name: "1 Muharam Tahun Baru Islam 1449 Hijriah" },
  { month: 8, day: 15, name: "Maulid Nabi Muhammad SAW" },
  { month: 8, day: 17, name: "Proklamasi Kemerdekaan Republik Indonesia" },
  { month: 12, day: 25, name: "Kelahiran Yesus Kristus (Natal)" },
  { month: 12, day: 26, name: "Isra Mikraj Nabi Muhammad SAW 1449 Hijriah" },
];

export async function seedPublicHolidays2027(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const h of HOLIDAYS_2027) {
    // UTC midnight — konsisten dengan todayMidnightUTC() yang dipakai app.
    const date = new Date(Date.UTC(2027, h.month - 1, h.day));
    const existing = await prisma.publicHoliday.findUnique({ where: { date }, select: { id: true } });

    await prisma.publicHoliday.upsert({
      where: { date },
      update: { name: h.name, isActive: true },
      create: { date, name: h.name, isActive: true },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(`✅ Hari libur nasional 2027 di-seed: ${created} baru, ${updated} diperbarui (total ${HOLIDAYS_2027.length}).`);
}

// Run standalone
if (process.argv[1]?.includes("public-holidays-2027")) {
  seedPublicHolidays2027()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
