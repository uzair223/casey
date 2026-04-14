import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { UserProvider } from "@/contexts/user-context";
import { TenantProvider } from "@/contexts/tenant-context";

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
  title: process.env.NEXT_PUBLIC_APP_NAME,
  description: `${process.env.NEXT_PUBLIC_APP_NAME} is a witness statement management tool designed for legal professionals. Streamline the intake, review, and management of witness statements with our secure and user-friendly platform.`,
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
      </body>
    </html>
  );
}
