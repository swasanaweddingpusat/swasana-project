interface InvitationEmailProps {
  fullName: string;
  verificationLink: string;
}

export function invitationEmailHtml({
  fullName,
  verificationLink,
}: InvitationEmailProps): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Undangan Bergabung — Swasana</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#000000;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">Swasana</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Halo <strong>${fullName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Anda telah diundang untuk bergabung ke sistem manajemen <strong>Swasana</strong>.
                Klik tombol di bawah untuk memverifikasi email dan membuat kata sandi Anda.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background-color:#000000;border-radius:6px;">
                    <a href="${verificationLink}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Verifikasi Email &amp; Atur Kata Sandi
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
                Tautan ini berlaku selama <strong>7 hari</strong> dan hanya dapat digunakan satu kali.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
                Setelah verifikasi, Anda akan diminta membuat kata sandi baru.
              </p>

              <!-- Security Notice -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:16px;">
                    <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.6;">
                      <strong>Perhatian keamanan:</strong> Jangan bagikan tautan ini kepada siapapun.
                      Tim Swasana tidak akan pernah meminta tautan ini dari Anda.
                    </p>
                  </td>
                </tr>
              </table>
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
                Jika Anda tidak merasa diundang, abaikan email ini. Tautan akan kedaluwarsa otomatis.
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
