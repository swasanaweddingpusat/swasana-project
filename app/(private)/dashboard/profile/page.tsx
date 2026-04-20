import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProfileClient } from "./_components/profile-client"

export const metadata: Metadata = {
  title: "Profile",
}

export default async function ProfilePage() {
  const session = await auth()

  const profile = session?.user?.id
    ? await db.profile.findUnique({
        where: { userId: session.user.id },
        include: { role: true },
      })
    : null

  return (
    <ProfileClient
      user={{
        id: session?.user?.id ?? "",
        name: session?.user?.name ?? "",
        email: session?.user?.email ?? "",
        image: session?.user?.image ?? null,
        role: profile?.role?.name ?? null,
        mustChangePassword: profile?.mustChangePassword ?? false,
      }}
    />
  )
}
