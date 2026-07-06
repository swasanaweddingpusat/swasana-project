import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans, Quicksand, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F4159",
};

export const metadata: Metadata = {
  // Base URL so relative OG/Twitter image paths resolve to absolute URLs.
  // Use `||` (not `??`) so an empty-string env (e.g. unset in Docker build) also
  // falls back to localhost — `new URL("")` throws ERR_INVALID_URL otherwise.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Swasana Wedding",
    template: "%s | Swasana Wedding",
  },
  description: "Sistem Manajemen Wedding Swasana",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Swasana",
  },
  // Default OG/Twitter card — inherited by every public & internal route unless a
  // page sets its own openGraph. Uses the shared brand image in /public for now.
  openGraph: {
    type: "website",
    siteName: "Swasana Wedding",
    title: "Swasana Wedding",
    description: "Sistem Manajemen Wedding Swasana",
    images: [
      {
        url: "/swasana-weddings.png",
        width: 1536,
        height: 1024,
        alt: "Swasana Wedding",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swasana Wedding",
    description: "Sistem Manajemen Wedding Swasana",
    images: ["/swasana-weddings.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable} ${quicksand.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <SessionProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-center" />
            </TooltipProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
