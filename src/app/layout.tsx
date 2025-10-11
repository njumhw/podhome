import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PodHome",
  description: "播客转写、总结与跨播客 QA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black dark:bg-black dark:text-white`}
      >
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>
        <footer className="mx-auto max-w-7xl px-6 pb-10">
          <div className="border-t border-black/10 dark:border-white/10 pt-6">
            <p className="text-[12px] leading-5 text-gray-500 dark:text-gray-400">
              本站仅用于内部学习与研究，内容来自公开播客。逐字稿与总结不用于商业用途。如有侵权请联系移除。
              <span id="admin-footer-link"></span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
