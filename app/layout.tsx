import type { Metadata } from "next";
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
  title: "ShareConLoad – Global Container Sharing",
  description: "Find and book shared container space for international shipments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="w-full bg-yellow-400 text-yellow-900 text-center text-sm font-semibold py-2 px-4 sticky top-0 z-50">
          ⚠ Test Environment — This site is not operational. Data entered here is for testing purposes only.
        </div>
        {children}
      </body>
    </html>
  );
}
