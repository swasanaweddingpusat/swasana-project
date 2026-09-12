import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

const STATUS_LABEL: Record<string, string> = {
  deal: "Deal",
  in_progress: "In Progress",
  pending: "Pending",
  to_be_discuss: "To Be Discuss",
  lost: "Lost",
};

function formatDateID(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildRows(data: GuestbookEntryItem[]): (string | number)[][] {
  return data.map((r, i) => [
    i + 1,
    r.visitorName ?? "-",
    r.company ?? "-",
    r.venue?.name ?? "-",
    r.host?.fullName ?? "-",
    r.sourceOfInformation?.name ?? "-",
    r.package?.packageName ?? "-",
    r.visitStatus ? (STATUS_LABEL[r.visitStatus] ?? r.visitStatus) : "-",
    r.createdBy?.fullName ?? "-",
    formatDateID(r.createdAt),
  ]);
}

export function exportGuestbookToPDF(data: GuestbookEntryItem[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BUKU TAMU", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Diekspor: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
    14,
    23,
  );
  doc.text(`Total: ${data.length} tamu`, 14, 29);

  autoTable(doc, {
    startY: 35,
    head: [["No", "Nama Tamu", "Perusahaan", "Venue", "Bertemu", "Sumber", "Paket", "Status", "Dicatat oleh", "Tanggal"]],
    body: buildRows(data),
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 65, 89] as [number, number, number],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
      7: { cellWidth: 20 },
      8: { cellWidth: 28 },
      9: { cellWidth: 22 },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`buku-tamu-${today}.pdf`);
}
