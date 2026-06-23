import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeesForExport } from "@/lib/queries/employees";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employees-export:${session.user.id}`)) return rateLimitResponse();

  const canExport = await hasPermission(session.user.roleId, "hr", "export");
  if (!canExport) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const rows = await getEmployeesForExport({ departmentId, status });

    const csvHeaders = [
      "No Karyawan",
      "Nama Lengkap",
      "Email",
      "NIK",
      "No. Telp",
      "Gender",
      "Agama",
      "Gol. Darah",
      "Tempat Lahir",
      "Tgl Lahir",
      "Status Perkawinan",
      "Pendidikan",
      "Tipe Karyawan",
      "Tgl Masuk",
      "Status",
      "NPWP",
      "BPJS Kesehatan",
      "BPJS TK",
      "Bank",
      "No Rekening",
      "Pemilik Rekening",
      "Departemen",
      "Posisi",
    ];

    const csvRows = rows.map((r) =>
      [
        r.employeeNumber,
        r.fullName ?? "",
        r.email,
        r.nik ?? "",
        r.phoneNumber ?? "",
        r.gender ?? "",
        r.religion ?? "",
        r.bloodType ?? "",
        r.placeOfBirth ?? "",
        r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().slice(0, 10) : "",
        r.maritalStatus ?? "",
        r.lastEducation ?? "",
        r.employmentType ?? "",
        r.joinDate ? new Date(r.joinDate).toISOString().slice(0, 10) : "",
        r.status,
        r.npwp ?? "",
        r.bpjsKesehatan ?? "",
        r.bpjsKetenagakerjaan ?? "",
        r.bankName ?? "",
        r.bankAccountNumber ?? "",
        r.bankAccountHolder ?? "",
        r.department?.name ?? "",
        r.position?.name ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [csvHeaders.join(","), ...csvRows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="karyawan-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return Response.json({ error: "Failed to export" }, { status: 500 });
  }
}
