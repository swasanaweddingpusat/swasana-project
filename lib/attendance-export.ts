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

const ATTENDANT_TYPE_LABEL: Record<string, string> = {
  WORKDAY: "Hari Kerja",
  DAY_OFF: "Libur Mingguan",
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
    tipeHari: ATTENDANT_TYPE_LABEL[r.attendantType] ?? r.attendantType,
    tanggalMerah: r.isPublicHoliday ? "Ya" : "Tidak",
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
    "Tipe Hari": r.tipeHari,
    "Tanggal Merah": r.tanggalMerah,
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
    { wch: 16 },
    { wch: 14 },
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
    head: [["No", "Nama Karyawan", "Tanggal", "Clock In", "Clock Out", "Status", "Lokasi", "Shift", "Tipe Hari", "Tanggal Merah"]],
    body: rows.map((r) => [
      r.no,
      r.nama,
      r.tanggal,
      r.clockIn,
      r.clockOut,
      r.status,
      r.lokasi,
      r.shift,
      r.tipeHari,
      r.tanggalMerah,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [15, 65, 89] as [number, number, number],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 38 },
      2: { cellWidth: 24 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 18 },
      6: { cellWidth: 30 },
      7: { cellWidth: 24 },
      8: { cellWidth: 20 },
      9: { cellWidth: 20 },
    },
  });

  doc.save(`rekap-kehadiran-${period}.pdf`);
}
