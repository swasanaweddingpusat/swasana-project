// ─── Types ───────────────────────────────────────────────────────────────────

export interface PayslipPdfData {
  employeeName: string;
  employeeNumber: number;
  departmentName: string | null;
  positionName: string | null;
  npwp: string | null;
  ptkpStatus: string | null;
  periodMonth: number;
  periodYear: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  pph21Amount: number;
  pph21Method: string | null;
  totalWorkDays: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
  absenceDeduction: number;
  lateDeduction: number;
  bpjsKesEmployee: number;
  jhtEmployee: number;
  jpEmployee: number;
  items: Array<{ name: string; type: string; amount: number; sortOrder: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function fmtIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generatePayslipHtml(data: PayslipPdfData): string {
  const periodLabel = `${MONTH_NAMES[(data.periodMonth ?? 1) - 1]} ${data.periodYear}`;

  const earningRows = data.items
    .filter((i) => i.type === "earning")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const deductionRows = data.items
    .filter((i) => i.type === "deduction")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function buildItemTableRows(items: PayslipPdfData["items"]): string {
    if (items.length === 0) {
      return `<tr><td colspan="3" style="color:#999;font-style:italic;font-size:8pt;padding:6px;">Tidak ada data</td></tr>`;
    }
    return items
      .map(
        (item, i) =>
          `<tr style="background:${i % 2 === 1 ? "#F4F6F5" : "#fff"}">
            <td style="width:8%;text-align:center;padding:5px;border-right:1px solid #C9CFCC;font-size:8pt;">${i + 1}</td>
            <td style="padding:5px;border-right:1px solid #C9CFCC;font-size:8pt;">${escapeHtml(item.name)}</td>
            <td style="width:30%;text-align:right;padding:5px;font-size:8pt;font-variant-numeric:tabular-nums;">${fmtIDR(item.amount)}</td>
          </tr>`,
      )
      .join("\n");
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Slip Gaji ${escapeHtml(data.employeeName)} - ${periodLabel}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 9pt;
      color: #1A1A1A;
      background: #fff;
      padding: 0;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 32px 32px 64px;
      position: relative;
    }

    /* ── Header (PO V2 style) ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .header-left .company-name {
      font-size: 20pt;
      font-weight: 800;
      color: #1A1A1A;
      letter-spacing: 1px;
    }
    .header-right {
      text-align: right;
    }
    .header-right .doc-title {
      font-size: 20pt;
      font-weight: bold;
      color: #1A1A1A;
      letter-spacing: 1px;
    }
    .header-right .doc-subtitle {
      font-size: 10pt;
      font-weight: bold;
      color: #3E6B5A;
      letter-spacing: 2px;
      margin-top: 2px;
    }

    /* ── Meta table 2x2 (PO V2 style) ── */
    .meta-table {
      border: 1px solid #C9CFCC;
      margin-bottom: 16px;
      border-collapse: collapse;
      width: 100%;
    }
    .meta-table td {
      padding: 5px;
      font-size: 8pt;
      vertical-align: middle;
    }
    .meta-label {
      background: #2F5545;
      color: #fff;
      font-weight: bold;
      width: 18%;
    }
    .meta-value {
      width: 32%;
      border-right: 1px solid #C9CFCC;
    }
    .meta-value-last {
      width: 32%;
    }

    /* ── Section titles (numbered, PO V2 style) ── */
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      color: #2F5545;
      margin-top: 12px;
      margin-bottom: 6px;
    }

    /* ── Card row (PO V2 party cards) ── */
    .card-row {
      display: flex;
      gap: 10px;
      margin-bottom: 6px;
    }
    .card {
      flex: 1;
      border: 1px solid #C9CFCC;
      border-radius: 4px;
      padding: 8px;
    }
    .card-head {
      font-size: 9pt;
      font-weight: bold;
      color: #2F5545;
      margin-bottom: 4px;
    }
    .card-line {
      font-size: 8pt;
      margin-bottom: 2px;
    }
    .card-label {
      font-weight: bold;
    }

    /* ── Generic PO-style table ── */
    .po-table {
      width: 100%;
      border: 1px solid #C9CFCC;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .po-table th {
      background: #3E6B5A;
      color: #fff;
      font-size: 8pt;
      font-weight: bold;
      padding: 5px;
      text-align: left;
      border-right: 1px solid rgba(255,255,255,0.33);
    }
    .po-table th:last-child {
      border-right: none;
    }
    .po-table td {
      font-size: 8pt;
      padding: 5px;
      border-top: 1px solid #C9CFCC;
      border-right: 1px solid #C9CFCC;
      vertical-align: middle;
    }
    .po-table td:last-child {
      border-right: none;
    }
    .po-table .total-row td {
      background: #2F5545;
      color: #fff;
      font-weight: bold;
      border-color: #2F5545;
    }
    .po-table .danger {
      color: #B3261E;
    }

    /* ── Attendance grid ── */
    .att-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .att-card {
      flex: 1;
      border: 1px solid #C9CFCC;
      border-radius: 4px;
      padding: 8px 6px;
      text-align: center;
    }
    .att-card .att-num {
      display: block;
      font-size: 16pt;
      font-weight: 800;
      color: #3E6B5A;
    }
    .att-card .att-label {
      display: block;
      font-size: 7pt;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 2px;
    }

    /* ── Net salary summary (PO V2 payment summary style) ── */
    .sum-table {
      width: 100%;
      border: 1px solid #C9CFCC;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 12px;
    }
    .sum-table th {
      background: #3E6B5A;
      color: #fff;
      font-size: 8pt;
      font-weight: bold;
      padding: 5px;
      text-align: left;
      border-right: 1px solid rgba(255,255,255,0.33);
    }
    .sum-table th:last-child {
      border-right: none;
    }
    .sum-table td {
      font-size: 8pt;
      padding: 5px;
      border-top: 1px solid #C9CFCC;
      border-right: 1px solid #C9CFCC;
    }
    .sum-table td:last-child {
      border-right: none;
    }
    .sum-table .sum-label {
      width: 70%;
      font-weight: bold;
    }
    .sum-table .sum-value {
      width: 30%;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sum-table .net-row td {
      background: #2F5545;
      color: #fff;
      font-weight: bold;
      font-size: 9pt;
      border-color: #2F5545;
    }
    .sum-table .net-row .net-highlight {
      color: #D4A547;
      font-size: 10pt;
    }

    /* ── Detail row (2-col label|value, PO V2 style) ── */
    .detail-table {
      width: 100%;
      border: 1px solid #C9CFCC;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .detail-table td {
      font-size: 8pt;
      padding: 5px;
      border-top: 1px solid #C9CFCC;
    }
    .detail-table .dl {
      width: 30%;
      font-weight: bold;
      color: #2F5545;
      border-right: 1px solid #C9CFCC;
    }
    .detail-table .dv {
      width: 70%;
    }

    /* ── Note ── */
    .note {
      font-size: 7pt;
      font-style: italic;
      color: #666;
      margin-top: 4px;
    }

    /* ── Footer (PO V2 style) ── */
    .footer {
      position: absolute;
      bottom: 20px;
      left: 32px;
      right: 32px;
      border-top: 1px solid #C9CFCC;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #777;
    }

    /* ── Print ── */
    @media print {
      body { padding: 0; background: #fff; }
      .page { padding: 12mm 12mm 16mm; margin: 0; width: 100%; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ── Header ── -->
    <div class="header">
      <div class="header-left">
        <div class="company-name">SWASANA</div>
      </div>
      <div class="header-right">
        <div class="doc-title">SLIP GAJI</div>
        <div class="doc-subtitle">SALARY SLIP</div>
      </div>
    </div>

    <!-- ── Meta table ── -->
    <table class="meta-table">
      <tr>
        <td class="meta-label">Periode</td>
        <td class="meta-value">${periodLabel}</td>
        <td class="meta-label">Dicetak</td>
        <td class="meta-value-last">${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
      </tr>
    </table>

    <!-- ── 1. INFORMASI KARYAWAN ── -->
    <div class="section-title">1. &nbsp;INFORMASI KARYAWAN</div>
    <table class="detail-table">
      <tr>
        <td class="dl">Nama Karyawan</td>
        <td class="dv">${escapeHtml(data.employeeName)}</td>
      </tr>
      <tr>
        <td class="dl">No. Karyawan</td>
        <td class="dv">${data.employeeNumber}</td>
      </tr>
      <tr>
        <td class="dl">Departemen</td>
        <td class="dv">${escapeHtml(data.departmentName ?? "-")}</td>
      </tr>
      <tr>
        <td class="dl">Posisi / Jabatan</td>
        <td class="dv">${escapeHtml(data.positionName ?? "-")}</td>
      </tr>
      <tr>
        <td class="dl">NPWP</td>
        <td class="dv">${escapeHtml(data.npwp ?? "-")}</td>
      </tr>
      <tr>
        <td class="dl">Status PTKP</td>
        <td class="dv">${escapeHtml(data.ptkpStatus ?? "-")}</td>
      </tr>
    </table>

    <!-- ── 2. RINGKASAN KEHADIRAN ── -->
    <div class="section-title">2. &nbsp;RINGKASAN KEHADIRAN</div>
    <div class="att-grid">
      <div class="att-card">
        <span class="att-num">${data.totalWorkDays}</span>
        <span class="att-label">Hari Kerja</span>
      </div>
      <div class="att-card">
        <span class="att-num">${data.totalPresent}</span>
        <span class="att-label">Hadir</span>
      </div>
      <div class="att-card">
        <span class="att-num">${data.totalAbsent}</span>
        <span class="att-label">Absen</span>
      </div>
      <div class="att-card">
        <span class="att-num">${data.totalLate}</span>
        <span class="att-label">Terlambat</span>
      </div>
      <div class="att-card">
        <span class="att-num">${data.totalLeave}</span>
        <span class="att-label">Cuti</span>
      </div>
    </div>

    <!-- ── 3. PENDAPATAN ── -->
    <div class="section-title">3. &nbsp;PENDAPATAN</div>
    <table class="po-table">
      <thead>
        <tr>
          <th style="width:8%;text-align:center;">No.</th>
          <th>Komponen</th>
          <th style="width:30%;text-align:right;">Nominal</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemTableRows(earningRows)}
        <tr class="total-row">
          <td colspan="2">TOTAL PENDAPATAN</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmtIDR(data.totalEarnings)}</td>
        </tr>
      </tbody>
    </table>

    <!-- ── 4. POTONGAN ── -->
    <div class="section-title">4. &nbsp;POTONGAN</div>
    <table class="po-table">
      <thead>
        <tr>
          <th style="width:8%;text-align:center;">No.</th>
          <th>Komponen</th>
          <th style="width:30%;text-align:right;">Nominal</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemTableRows(deductionRows)}
        <tr class="total-row">
          <td colspan="2">TOTAL POTONGAN</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmtIDR(data.totalDeductions)}</td>
        </tr>
      </tbody>
    </table>

    <!-- ── 5. PERHITUNGAN GAJI BERSIH ── -->
    <div class="section-title">5. &nbsp;PERHITUNGAN GAJI BERSIH</div>
    <table class="sum-table">
      <thead>
        <tr>
          <th style="width:70%;">KETERANGAN</th>
          <th style="width:30%;text-align:right;">NOMINAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="sum-label">Total Pendapatan</td>
          <td class="sum-value">${fmtIDR(data.totalEarnings)}</td>
        </tr>
        <tr>
          <td class="sum-label danger">Total Potongan</td>
          <td class="sum-value danger">- ${fmtIDR(data.totalDeductions)}</td>
        </tr>
        <tr class="net-row">
          <td class="sum-label net-highlight">Gaji Bersih (Take Home Pay)</td>
          <td class="sum-value" style="text-align:right;font-variant-numeric:tabular-nums;">${fmtIDR(data.netSalary)}</td>
        </tr>
      </tbody>
    </table>
    <p class="note">*Slip gaji ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah.</p>

    <!-- ── Footer ── -->
    <div class="footer">
      <span>SWASANA &middot; Human Resources Department</span>
      <span>Halaman 1</span>
    </div>

  </div>
</body>
</html>`;
}
