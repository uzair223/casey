import { env } from "@/lib/env";
import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { UserProvider } from "@/contexts/user-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: `${env.NEXT_PUBLIC_APP_NAME} helps UK claimant firms turn guided witness intake into review-ready statement drafts with less chasing, clearer evidence, and governed workflows.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${manrope.variable} min-h-screen antialiased`}
      >
        <div className="fixed inset-0 w-screen h-screen bg-aurora -z-50" />
        <UserProvider>
          <TenantProvider>{children}</TenantProvider>
        </UserProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
