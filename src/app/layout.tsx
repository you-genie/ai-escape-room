import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "탈출 - 폐병원 수술실",
  description: "AI 텍스트 기반 공포 방탈출 게임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col font-mono bg-[#0a0a0a] text-[#c4c4c4]">
        {children}
      </body>
    </html>
  );
}
