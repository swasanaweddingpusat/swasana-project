import { Suspense } from "react";
import { AuthGate } from "./_components/auth-gate";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
