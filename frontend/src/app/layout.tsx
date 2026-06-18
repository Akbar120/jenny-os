import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SidebarClient from "../components/SidebarClient";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Jenny OS — Lead Hunter Dashboard",
  description: "Modular AI business automation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`} suppressHydrationWarning>
      <body className="min-h-full h-full bg-zinc-950 text-zinc-100 flex font-sans overflow-hidden" suppressHydrationWarning>
        <SidebarClient />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-zinc-900/30">
          {children}
        </main>
      </body>
    </html>
  );
}
