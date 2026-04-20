import { Sidebar } from "./_components/sidebar/sidebar";
import { MobileSidebar } from "./_components/sidebar/mobile-sidebar";
import { SidebarProvider } from "./_components/sidebar/sidebar-context";
import { Header } from "./_components/header/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <MobileSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
