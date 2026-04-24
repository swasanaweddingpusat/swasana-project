import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProfileClient } from "./_components/profile-client"

export const metadata: Metadata = { title: "Profile - SWASANA" }

export default async function ProfilePage() {
  const session = await auth()

  const [profile, educationLevels] = await Promise.all([
    session?.user?.id
      ? db.profile.findUnique({ where: { userId: session.user.id }, include: { role: true } })
      : null,
    db.educationLevel.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ])

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
      profile={profile ? {
        id: profile.id,
        employeeId: profile.employeeId,
        fullName: profile.fullName,
        nickName: profile.nickName,
        gender: profile.gender,
        phoneNumber: profile.phoneNumber,
        nik: profile.nik,
        kkNumber: profile.kkNumber,
        placeOfBirth: profile.placeOfBirth,
        dateOfBirth: profile.dateOfBirth?.toISOString().split("T")[0] ?? null,
        ktpAddress: profile.ktpAddress,
        currentAddress: profile.currentAddress,
        city: profile.city,
        motherName: profile.motherName,
        maritalStatus: profile.maritalStatus,
        numberOfChildren: profile.numberOfChildren,
        lastEducation: profile.lastEducation,
        bankName: profile.bankName,
        bankAccountNumber: profile.bankAccountNumber,
        bankAccountHolder: profile.bankAccountHolder,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactRel: profile.emergencyContactRel,
        emergencyContactPhone: profile.emergencyContactPhone,
        avatarUrl: profile.avatarUrl,
      } : null}
      educationLevels={educationLevels}
    />
  )
}
