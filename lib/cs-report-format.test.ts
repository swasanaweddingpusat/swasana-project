import { describe, expect, it } from "vitest";
import { formatCsReportWhatsApp, type CsReportData } from "@/lib/cs-report-format";

describe("formatCsReportWhatsApp", () => {
  it("menghasilkan template copy WhatsApp CS yang siap dikirim", () => {
    const data: CsReportData = {
      date: "2026-09-27",
      totalChatMasuk: 171,
      chatJadiDatabase: 72,
      databaseRespon: 58,
      databaseNoRespon: 14,
      spamPrank: 19,
      adsSpam: [
        { key: "ad-1", url: "https://www.instagram.com/p/DdoCm0LAdp-/", count: 2 },
        { key: "ad-2", url: "https://www.instagram.com/p/DdoFUoAAl9I/", count: 3 },
      ],
      organikSpam: 0,
      sources: [
        { key: "wa", label: "WA - KEDIAMAN", count: 134 },
        { key: "threads", label: "Threads", count: 13 },
      ],
    };

    const jakartaEvening = new Date("2026-09-28T13:00:00.000Z");

    expect(formatCsReportWhatsApp(data, jakartaEvening)).toBe(`Assalamualaikum Selamat Malam,
Berikut Report Chat Masuk Kemarin 27 September 2026

Total Chat Masuk : 171
Chat Jadi Database : 72
Spam/Prank : 19

_*Sumber Iklan Spam*_
https://www.instagram.com/p/DdoCm0LAdp-/  :  2
https://www.instagram.com/p/DdoFUoAAl9I/  :  3
Organik : 0

_*Sumber Chat Masuk*_
WA - KEDIAMAN  :  134
Threads  :  13

TOTAL CHAT MASUK : 171`);
  });
});
