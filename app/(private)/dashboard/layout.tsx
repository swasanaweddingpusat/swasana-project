import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SwasanaSidebar } from "./_components/sidebar/sidebar";
import { Header } from "./_components/header/header";
import { AuthGate } from "../_components/auth-gate";
import { HeaderActionProvider } from "@/components/providers/header-action-provider";
import { BookingDrawerProvider } from "@/components/providers/booking-drawer-provider";
import { LeadDrawerProvider } from "@/components/providers/lead-drawer-provider";
import { QuotationDrawerProvider } from "@/components/providers/quotation-drawer-provider";
import { MiceBookingDrawerProvider } from "@/components/providers/mice-booking-drawer-provider";
import { ProcurementDrawerProvider } from "@/components/providers/procurement-drawer-provider";
import { MobileBottomNav } from "./_components/mobile-bottom-nav/MobileBottomNav";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <HeaderActionProvider>
        <BookingDrawerProvider>
          <MiceBookingDrawerProvider>
            <QuotationDrawerProvider>
              <LeadDrawerProvider>
                <ProcurementDrawerProvider>
                <Suspense fallback={null}>
                  <SwasanaSidebar />
                </Suspense>
                <SidebarInset>
                  <Suspense>
                    <Header />
                  </Suspense>
                  <main className="flex-1 p-4 pb-24 md:pb-6 lg:p-6">
                    <Suspense>
                      <AuthGate>{children}</AuthGate>
                    </Suspense>
                  </main>
                  <Suspense fallback={null}>
                    <MobileBottomNav />
                  </Suspense>
                  <PwaInstallPrompt />
                  <ServiceWorkerRegister />
                </SidebarInset>
              </ProcurementDrawerProvider>
              </LeadDrawerProvider>
            </QuotationDrawerProvider>
          </MiceBookingDrawerProvider>
        </BookingDrawerProvider>
      </HeaderActionProvider>
    </SidebarProvider>
  );
}
