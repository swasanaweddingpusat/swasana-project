import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  // Force password change for new users
  if (session.user.mustChangePassword) {
    redirect("/auth/reset-password?force=true");
  }

  return <>{children}</>;
}
