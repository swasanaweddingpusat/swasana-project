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

function itemRows(items: PayslipPdfData["items"], type: string): string {
  const filtered = items
    .filter((i) => i.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (filtered.length === 0) {
    return `<tr><td colspan="2" class="empty-row">Tidak ada data</td></tr>`;
  }

  return filtered
    .map(
      (i) =>
        `<tr>
          <td>${escapeHtml(i.name)}</td>
          <td class="amount">${fmtIDR(i.amount)}</td>
        </tr>`,
    )
    .join("\n");
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generatePayslipHtml(data: PayslipPdfData): string {
  const periodLabel = `${MONTH_NAMES[(data.periodMonth ?? 1) - 1]} ${data.periodYear}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Slip Gaji ${escapeHtml(data.employeeName)} - ${periodLabel}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page ── */
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 15mm 15mm 20mm;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 2px solid #0F4159;
      margin-bottom: 14px;
    }

    .company-name {
      font-size: 22pt;
      font-weight: 800;
      color: #0F4159;
      letter-spacing: 1px;
    }

    .slip-title {
      font-size: 12pt;
      color: #555;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .period-label {
      font-size: 13pt;
      font-weight: 700;
      color: #0F4159;
      text-align: right;
    }

    .period-sub {
      font-size: 9pt;
      color: #888;
      text-align: right;
      margin-top: 2px;
    }

    /* ── Employee Info Grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 20px;
      margin-bottom: 14px;
      padding: 12px 14px;
      background: #f8f8f8;
      border-radius: 6px;
    }

    .info-item label {
      display: block;
      font-size: 8pt;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .info-item span {
      font-size: 10pt;
      font-weight: 600;
      color: #1a1a1a;
    }

    /* ── Section Title ── */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0F4159;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e0e0e0;
    }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10pt;
    }

    table td {
      padding: 5px 6px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: middle;
    }

    table td.amount {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      white-space: nowrap;
    }

    table tr.subtotal td {
      font-weight: 700;
      border-top: 1.5px solid #ccc;
      border-bottom: none;
      padding-top: 7px;
    }

    table tr:last-child td {
      border-bottom: none;
    }

    .empty-row {
      color: #bbb;
      font-style: italic;
      font-size: 9pt;
    }

    /* ── Two-column layout for earnings/deductions ── */
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 12px;
    }

    /* ── Attendance Summary ── */
    .attendance {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }

    .att-box {
      background: #f5f5f5;
      border-radius: 6px;
      padding: 8px 6px;
      text-align: center;
    }

    .att-box .att-num {
      display: block;
      font-size: 16pt;
      font-weight: 800;
      color: #0F4159;
    }

    .att-box .att-label {
      display: block;
      font-size: 7.5pt;
      color: #888;
      margin-top: 2px;
    }

    /* ── Net Salary Box ── */
    .net-box {
      background: #0F4159;
      color: #fff;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }

    .net-box .net-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10pt;
      margin-bottom: 6px;
      color: rgba(255,255,255,0.8);
    }

    .net-box .net-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.2);
      margin: 8px 0;
    }

    .net-box .net-final {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .net-box .net-title {
      font-size: 11pt;
      font-weight: 700;
      color: #D4A547;
    }

    .net-box .net-amount {
      font-size: 18pt;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 8.5pt;
      color: #999;
    }

    .signature-block {
      text-align: center;
    }

    .signature-line {
      width: 140px;
      border-top: 1px solid #555;
      margin-top: 40px;
    }

    /* ── Print ── */
    @media print {
      body { padding: 0; background: #fff; }
      .page { padding: 12mm 12mm 16mm; margin: 0; width: 100%; }
      .no-print { display: none !important; }

      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ── Header ── -->
    <div class="header">
      <div>
        <div class="company-name">SWASANA</div>
        <div class="slip-title">Slip Gaji</div>
      </div>
      <div>
        <div class="period-label">${periodLabel}</div>
        <div class="period-sub">Periode Penggajian</div>
      </div>
    </div>

    <!-- ── Employee Info ── -->
    <div class="info-grid">
      <div class="info-item">
        <label>Nama Karyawan</label>
        <span>${escapeHtml(data.employeeName)}</span>
      </div>
      <div class="info-item">
        <label>No. Karyawan</label>
        <span>${data.employeeNumber}</span>
      </div>
      <div class="info-item">
        <label>Departemen</label>
        <span>${escapeHtml(data.departmentName ?? "-")}</span>
      </div>
      <div class="info-item">
        <label>Posisi / Jabatan</label>
        <span>${escapeHtml(data.positionName ?? "-")}</span>
      </div>
      <div class="info-item">
        <label>NPWP</label>
        <span>${escapeHtml(data.npwp ?? "-")}</span>
      </div>
      <div class="info-item">
        <label>Status PTKP</label>
        <span>${escapeHtml(data.ptkpStatus ?? "-")}</span>
      </div>
    </div>

    <!-- ── Earnings & Deductions ── -->
    <div class="columns">
      <!-- Pendapatan -->
      <div>
        <div class="section-title">Pendapatan</div>
        <table>
          <tbody>
            ${itemRows(data.items, "earning")}
            <tr class="subtotal">
              <td>Total Pendapatan</td>
              <td class="amount">${fmtIDR(data.totalEarnings)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Potongan -->
      <div>
        <div class="section-title">Potongan</div>
        <table>
          <tbody>
            ${itemRows(data.items, "deduction")}
            <tr class="subtotal">
              <td>Total Potongan</td>
              <td class="amount">${fmtIDR(data.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Attendance Summary ── -->
    <div class="section-title">Ringkasan Kehadiran</div>
    <div class="attendance">
      <div class="att-box">
        <span class="att-num">${data.totalWorkDays}</span>
        <span class="att-label">Hari Kerja</span>
      </div>
      <div class="att-box">
        <span class="att-num">${data.totalPresent}</span>
        <span class="att-label">Hadir</span>
      </div>
      <div class="att-box">
        <span class="att-num">${data.totalAbsent}</span>
        <span class="att-label">Absen</span>
      </div>
      <div class="att-box">
        <span class="att-num">${data.totalLate}</span>
        <span class="att-label">Terlambat</span>
      </div>
      <div class="att-box">
        <span class="att-num">${data.totalLeave}</span>
        <span class="att-label">Cuti</span>
      </div>
    </div>

    <!-- ── Net Salary ── -->
    <div class="net-box">
      <div class="net-row">
        <span>Total Pendapatan</span>
        <span>${fmtIDR(data.totalEarnings)}</span>
      </div>
      <div class="net-row">
        <span>Total Potongan</span>
        <span>- ${fmtIDR(data.totalDeductions)}</span>
      </div>
      <hr class="net-divider" />
      <div class="net-final">
        <span class="net-title">Gaji Bersih (Take Home Pay)</span>
        <span class="net-amount">${fmtIDR(data.netSalary)}</span>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="footer">
      <div>
        <div>Dokumen ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah.</div>
        <div style="margin-top:2px;">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div class="signature-block">
        <div class="signature-line" style="margin-left:auto;"></div>
        <div style="margin-top:4px; color:#555; font-size:9pt;">Human Resources</div>
        <div style="font-size:8pt; color:#bbb;">SWASANA</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}
