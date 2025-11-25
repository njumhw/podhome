import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";

// 在服务器端初始化应用
if (typeof window === 'undefined') {
  import("@/server/startup");
}

// 加载字体
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased font-sans`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider>
          <ToastProvider>
            <Header />
            <main className="mx-auto max-w-7xl px-6 py-8">
              {children}
            </main>
            <footer className="mx-auto max-w-7xl px-6 pb-10">
              <div className="border-t border-white/5 pt-6">
                <p className="text-[12px] leading-5 text-gray-400 font-mono">
                  本站仅用于内部学习与研究，内容来自公开播客。逐字稿与总结不用于商业用途。如有侵权请联系移除。
                  <span id="admin-footer-link"></span>
                </p>
              </div>
            </footer>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
