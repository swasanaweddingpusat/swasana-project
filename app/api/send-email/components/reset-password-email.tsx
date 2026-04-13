import * as React from "react";

interface ResetPasswordEmailProps {
  resetUrl: string;
  userName: string;
}

export function ResetPasswordEmail({ resetUrl, userName }: ResetPasswordEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#f8f9fa", padding: "40px 20px", textAlign: "center" }}>
        <h1 style={{ color: "#1a1a1a", fontSize: "24px", marginBottom: "8px" }}>
          Swasana Wedding
        </h1>
      </div>
      <div style={{ padding: "40px 20px" }}>
        <p>Halo {userName},</p>
        <p>
          Kami menerima permintaan reset password untuk akun Anda. Klik tombol
          di bawah untuk membuat password baru.
        </p>
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <a
            href={resetUrl}
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "12px 32px",
              borderRadius: "6px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: "bold",
            }}
          >
            Reset Password
          </a>
        </div>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password,
          abaikan email ini.
        </p>
        <p style={{ fontSize: "12px", color: "#999", marginTop: "24px" }}>
          Atau salin link ini: {resetUrl}
        </p>
      </div>
    </div>
  );
}
