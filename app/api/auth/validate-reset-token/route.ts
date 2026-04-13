import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token tidak ditemukan" }, { status: 400 })
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { profile: true },
    })

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: "Token tidak valid" }, { status: 400 })
    }

    if (resetToken.used) {
      return NextResponse.json({ valid: false, error: "Token sudah digunakan" }, { status: 400 })
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({ valid: false, error: "Token sudah kedaluwarsa" }, { status: 400 })
    }

    return NextResponse.json({ valid: true, email: resetToken.profile.email })
  } catch (error) {
    console.error("Validate reset token error:", error)
    return NextResponse.json({ valid: false, error: "Terjadi kesalahan" }, { status: 500 })
  }
}
