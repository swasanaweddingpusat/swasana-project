import type { APEvent, APPayable } from "@/types/finance";

/**
 * Dummy AP data — UI-first scaffolding. No DB yet.
 * Replace with a real query/hook once the schema lands.
 */

function payable(p: Partial<APPayable> & Pick<APPayable, "id" | "category" | "payeeName" | "title" | "amount">): APPayable {
  const paidAmount = p.paidAmount ?? 0;
  const amount = p.amount;
  const outstanding = amount - paidAmount;
  const status: APPayable["status"] =
    p.status ?? (outstanding <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid");
  return {
    eventName: null,
    eventId: null,
    eventDate: null,
    eventDone: false,
    dueDate: "2026-07-01",
    ackStatus: "pending",
    acknowledgedAt: null,
    acknowledgedByName: null,
    notes: null,
    payments: [],
    ...p,
    amount,
    paidAmount,
    outstanding,
    status,
  };
}

export const AP_PAYABLES: APPayable[] = [
  payable({
    id: "ap-1",
    category: "bonus-sales",
    payeeName: "Rizky Pratama",
    title: "Bonus closing — Wedding Andini & Bagas",
    eventName: "Wedding Andini & Bagas",
    eventId: "evt-1",
    eventDate: "2026-06-14",
    eventDone: true,
    amount: 3_500_000,
    dueDate: "2026-06-28",
  }),
  payable({
    id: "ap-2",
    category: "fee-manager",
    payeeName: "Catering Sekar Rasa",
    title: "Fee manager catering — Wedding Andini & Bagas",
    eventName: "Wedding Andini & Bagas",
    eventId: "evt-1",
    eventDate: "2026-06-14",
    eventDone: true,
    amount: 6_000_000,
    paidAmount: 3_000_000,
    dueDate: "2026-06-30",
    notes: "DP 50% sudah dibayar 12 Jun",
    payments: [
      { id: "pay-1", amount: 3_000_000, paidAt: "2026-06-12", method: "Transfer BCA", notes: "DP 50%" },
    ],
  }),
  payable({
    id: "ap-3",
    category: "tunjangan-wp",
    payeeName: "Wedding Planner — Tim Melati",
    title: "Tunjangan WP — Wedding Andini & Bagas",
    eventName: "Wedding Andini & Bagas",
    eventId: "evt-1",
    eventDate: "2026-06-14",
    eventDone: true,
    amount: 2_000_000,
    dueDate: "2026-06-21",
  }),
  payable({
    id: "ap-4",
    category: "tunjangan-wp",
    payeeName: "Wedding Planner — Tim Anggrek",
    title: "Tunjangan WP — Wedding Sinta & Dimas",
    eventName: "Wedding Sinta & Dimas",
    eventId: "evt-2",
    eventDate: "2026-07-19",
    eventDone: false,
    amount: 2_000_000,
    status: "on_hold",
    dueDate: "2026-07-26",
    notes: "Menunggu event selesai",
  }),
  payable({
    id: "ap-5",
    category: "bonus-sales",
    payeeName: "Dewi Lestari",
    title: "Bonus closing — Wedding Sinta & Dimas",
    eventName: "Wedding Sinta & Dimas",
    eventId: "evt-2",
    eventDate: "2026-07-19",
    eventDone: false,
    amount: 4_200_000,
    dueDate: "2026-07-25",
  }),
  payable({
    id: "ap-6",
    category: "mice",
    payeeName: "PT Sound & Lighting Pro",
    title: "Vendor sound system — Gathering Corp XYZ",
    eventName: "Gathering Corporate XYZ",
    eventId: "evt-3",
    eventDate: "2026-06-30",
    eventDone: false,
    amount: 8_500_000,
    dueDate: "2026-07-05",
  }),
  payable({
    id: "ap-7",
    category: "mice",
    payeeName: "Dekorasi Indah Permai",
    title: "Dekorasi panggung — Gathering Corp XYZ",
    eventName: "Gathering Corporate XYZ",
    eventId: "evt-3",
    eventDate: "2026-06-30",
    eventDone: false,
    amount: 5_000_000,
    paidAmount: 5_000_000,
    dueDate: "2026-06-20",
    ackStatus: "acknowledged",
    acknowledgedAt: "2026-06-18",
    acknowledgedByName: "Finance — Putri",
    payments: [
      { id: "pay-2", amount: 5_000_000, paidAt: "2026-06-18", method: "Transfer Mandiri", notes: "Lunas" },
    ],
  }),
  payable({
    id: "ap-8",
    category: "general-expense",
    payeeName: "PLN",
    title: "Listrik venue — Juni 2026",
    amount: 4_750_000,
    dueDate: "2026-07-10",
  }),
  payable({
    id: "ap-9",
    category: "general-expense",
    payeeName: "ATK Sentosa",
    title: "Pembelian ATK kantor",
    amount: 1_250_000,
    paidAmount: 1_250_000,
    dueDate: "2026-06-15",
    ackStatus: "acknowledged",
    acknowledgedAt: "2026-06-15",
    acknowledgedByName: "Finance — Putri",
    payments: [
      { id: "pay-3", amount: 1_250_000, paidAt: "2026-06-15", method: "Cash", notes: null },
    ],
  }),
];

/** Group payables that belong to an event (eventId != null) into APEvent rows. */
export function buildApEvents(payables: APPayable[]): APEvent[] {
  const byEvent = new Map<string, APEvent>();
  for (const p of payables) {
    if (!p.eventId || !p.eventName) continue;
    let ev = byEvent.get(p.eventId);
    if (!ev) {
      ev = {
        id: p.eventId,
        eventName: p.eventName,
        eventDate: p.eventDate ?? "-",
        eventDone: p.eventDone,
        totalPayable: 0,
        totalOutstanding: 0,
        payables: [],
      };
      byEvent.set(p.eventId, ev);
    }
    ev.payables.push(p);
    ev.totalPayable += p.amount;
    ev.totalOutstanding += p.outstanding;
  }
  return Array.from(byEvent.values());
}
