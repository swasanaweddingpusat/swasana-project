import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SwasanaSidebar } from "./_components/sidebar/sidebar";
import { Header } from "./_components/header/header";
import { AuthGate } from "./_components/auth-gate";
import { HeaderActionProvider } from "@/components/providers/header-action-provider";
import { BookingDrawerProvider } from "@/components/providers/booking-drawer-provider";
import { DailyActivityDrawerProvider } from "@/components/providers/daily-activity-drawer-provider";
import { QuotationDrawerProvider } from "@/components/providers/quotation-drawer-provider";
import { MiceBookingDrawerProvider } from "@/components/providers/mice-booking-drawer-provider";
import { ProcurementDrawerProvider } from "@/components/providers/procurement-drawer-provider";
import { MobileBottomNav } from "./_components/mobile-bottom-nav/MobileBottomNav";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";

// Reads the session cookie (runtime data) and hydrates SessionProvider for the
// entire private subtree — the only place useSession is consumed. Kept in a
// child component behind <Suspense> so the cookie read doesn't block the static
// shell of routes that render before auth resolves (Cache Components).
async function SessionBoundary({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await auth();
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No auth gate at the outer boundary — proxy.ts handles redirect for
  // unauthenticated users. The module shell (sidebar + header) renders instantly;
  // auth-dependent checks (mustChangePassword, suspended, etc.) are handled by
  // AuthGate wrapping only the content area below.
  return (
    <Suspense fallback={null}>
      <SessionBoundary>
        <SidebarProvider>
          <HeaderActionProvider>
            <BookingDrawerProvider>
              <MiceBookingDrawerProvider>
                <QuotationDrawerProvider>
                  <DailyActivityDrawerProvider>
                    <ProcurementDrawerProvider>
                      <Suspense fallback={null}>
                        <SwasanaSidebar />
                      </Suspense>
                      <SidebarInset className="min-w-0">
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
                  </DailyActivityDrawerProvider>
                </QuotationDrawerProvider>
              </MiceBookingDrawerProvider>
            </BookingDrawerProvider>
          </HeaderActionProvider>
        </SidebarProvider>
      </SessionBoundary>
    </Suspense>
  );
}
