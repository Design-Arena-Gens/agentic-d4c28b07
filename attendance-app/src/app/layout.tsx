import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Attendance",
  description:
    "Absensi kehadiran berbasis geolocation dan QR code terintegrasi Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-slate-100">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <div className="text-lg font-semibold text-slate-900">
                Smart Attendance
              </div>
              <div className="flex gap-3 text-sm font-medium text-slate-600">
                <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href="/">
                  Absensi
                </Link>
                <Link
                  className="rounded-md px-3 py-2 hover:bg-slate-100"
                  href="/dashboard"
                >
                  Dashboard
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
