interface ApplicationConfirmationEmailProps {
  fullName: string;
  jobTitle: string;
  companyName: string;
}

export function applicationConfirmationEmailHtml({
  fullName,
  jobTitle,
  companyName,
}: ApplicationConfirmationEmailProps): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lamaran Diterima — Swasana</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0F4159;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">Swasana</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Halo <strong>${fullName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Lamaran Anda untuk posisi <strong>${jobTitle}</strong> di <strong>${companyName}</strong>
                telah berhasil kami terima.
              </p>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px;">
                    <p style="margin:0;font-size:14px;color:#0369a1;line-height:1.6;">
                      Tim kami akan meninjau lamaran Anda dan menghubungi Anda melalui email atau
                      nomor telepon yang telah Anda cantumkan apabila Anda memenuhi kualifikasi.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
                Harap simpan email ini sebagai bukti bahwa Anda telah melamar.
              </p>
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
                Terima kasih atas ketertarikan Anda bergabung bersama kami.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Email ini dikirim secara otomatis oleh sistem Swasana. Mohon tidak membalas email ini.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Swasana. Semua hak dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
