import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AttendanceExportItem } from "@/lib/queries/attendance";

const STATUS_LABEL: Record<string, string> = {
  on_time: "Hadir",
  late: "Terlambat",
  absent: "Absen",
  on_leave: "Cuti",
};

function formatDateID(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeShort(value: string | Date | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRows(data: AttendanceExportItem[]) {
  return data.map((r, i) => ({
    no: i + 1,
    nama: r.profile.fullName ?? "-",
    tanggal: formatDateID(r.date),
    clockIn: formatTimeShort(r.clockInAt),
    clockOut: formatTimeShort(r.clockOutAt),
    status: STATUS_LABEL[r.status] ?? r.status,
    lokasi: r.workLocation?.name ?? "-",
    shift: r.workShift?.name ?? "-",
  }));
}

export function exportToExcel(data: AttendanceExportItem[], period: string): void {
  const rows = buildRows(data).map((r) => ({
    No: r.no,
    "Nama Karyawan": r.nama,
    Tanggal: r.tanggal,
    "Clock In": r.clockIn,
    "Clock Out": r.clockOut,
    Status: r.status,
    Lokasi: r.lokasi,
    Shift: r.shift,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Kehadiran");
  XLSX.writeFile(wb, `rekap-kehadiran-${period}.xlsx`);
}

export function exportToPDF(
  data: AttendanceExportItem[],
  period: string,
  periodLabel: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("REKAP KEHADIRAN", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periode: ${periodLabel}`, 14, 23);
  doc.text(
    `Diekspor: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
    14,
    29,
  );

  const rows = buildRows(data);

  autoTable(doc, {
    startY: 35,
    head: [["No", "Nama Karyawan", "Tanggal", "Clock In", "Clock Out", "Status", "Lokasi", "Shift"]],
    body: rows.map((r) => [
      r.no,
      r.nama,
      r.tanggal,
      r.clockIn,
      r.clockOut,
      r.status,
      r.lokasi,
      r.shift,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [15, 65, 89] as [number, number, number],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 45 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
      6: { cellWidth: 38 },
      7: { cellWidth: 30 },
    },
  });

  doc.save(`rekap-kehadiran-${period}.pdf`);
}
