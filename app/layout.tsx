import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Swasana Wedding",
    template: "%s | Swasana Wedding",
  },
  description: "Sistem Manajemen Wedding Swasana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${openSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <SessionProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
