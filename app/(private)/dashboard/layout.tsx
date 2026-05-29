import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SwasanaSidebar } from "./_components/sidebar/sidebar";
import { Header } from "./_components/header/header";
import { AuthGate } from "../_components/auth-gate";
import { HeaderActionProvider } from "@/components/providers/header-action-provider";
import { BookingDrawerProvider } from "@/components/providers/booking-drawer-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <HeaderActionProvider>
        <BookingDrawerProvider>
          <SwasanaSidebar />
          <SidebarInset>
            <Suspense>
              <Header />
            </Suspense>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              <Suspense>
                <AuthGate>{children}</AuthGate>
              </Suspense>
            </main>
          </SidebarInset>
        </BookingDrawerProvider>
      </HeaderActionProvider>
    </SidebarProvider>
  );
}
