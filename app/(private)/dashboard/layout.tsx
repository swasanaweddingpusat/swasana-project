import { Suspense } from "react";
import { connection } from "next/server";
import { Sidebar } from "./_components/sidebar/sidebar";
import { MobileSidebar } from "./_components/sidebar/mobile-sidebar";
import { SidebarProvider } from "./_components/sidebar/sidebar-context";
import { Header } from "./_components/header/header";
import { AuthGate } from "../_components/auth-gate";
import { HeaderActionProvider } from "@/components/providers/header-action-provider";
import { BookingDrawerProvider } from "@/components/providers/booking-drawer-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <SidebarProvider>
      <HeaderActionProvider>
        <BookingDrawerProvider>
        <div className="flex h-screen bg-gray-100">
          <Suspense><Sidebar /></Suspense>
          <Suspense><MobileSidebar /></Suspense>
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Suspense><Header /></Suspense>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              <Suspense>
                <AuthGate>{children}</AuthGate>
              </Suspense>
            </main>
          </div>
        </div>
        </BookingDrawerProvider>
      </HeaderActionProvider>
    </SidebarProvider>
  );
}
