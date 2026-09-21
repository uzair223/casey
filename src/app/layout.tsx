import { env } from "@/lib/env";
import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";

import { UserProvider } from "@/contexts/user-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: `Casey interviews witnesses, gathers evidence and finds what's missing, so your solicitors start with a review-ready first draft.`,
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} min-h-screen bg-background antialiased`}
      >
        <UserProvider>
          <TenantProvider>{children}</TenantProvider>
        </UserProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
