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

function formatCoord(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return "-";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
    koordinatMasuk: formatCoord(r.clockInLat, r.clockInLng),
    koordinatKeluar: formatCoord(r.clockOutLat, r.clockOutLng),
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
    "Koordinat Masuk": r.koordinatMasuk,
    "Koordinat Keluar": r.koordinatKeluar,
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
    { wch: 20 },
    { wch: 20 },
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
    head: [["No", "Nama Karyawan", "Tanggal", "Clock In", "Clock Out", "Status", "Lokasi", "Shift", "Tipe Hari", "Tgl Merah", "Koordinat Masuk", "Koordinat Keluar"]],
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
      r.koordinatMasuk,
      r.koordinatKeluar,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [15, 65, 89] as [number, number, number],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 13 },
      4: { cellWidth: 13 },
      5: { cellWidth: 15 },
      6: { cellWidth: 24 },
      7: { cellWidth: 18 },
      8: { cellWidth: 16 },
      9: { cellWidth: 16 },
      10: { cellWidth: 26 },
      11: { cellWidth: 26 },
    },
  });

  doc.save(`rekap-kehadiran-${period}.pdf`);
}
