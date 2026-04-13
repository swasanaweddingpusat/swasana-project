import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token dan password wajib diisi" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 })
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { profile: true },
    })

    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
      return NextResponse.json({ error: "Token tidak valid atau sudah kedaluwarsa" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await db.user.update({
      where: { email: resetToken.profile.email },
      data: { password: hashedPassword },
    })

    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 })
  }
}
