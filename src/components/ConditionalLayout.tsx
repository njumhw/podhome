"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

/**
 * 条件布局组件
 * 对于 /mulerun/* 路由，不显示 Header 和 Footer
 * 对于其他路由，显示正常的 Header 和 Footer
 */
export function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMulerunRoute = pathname?.startsWith("/mulerun");

  if (isMulerunRoute) {
    // MuleRun 路由：不显示 Header 和 Footer
    return <main className="min-h-screen bg-white">{children}</main>;
  }

  // 其他路由：显示正常的 Header 和 Footer
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-6 pb-10">
        <div className="border-t border-white/5 pt-6">
          <p className="text-[12px] leading-5 text-gray-400 font-mono">
            本站仅用于内部学习与研究，内容来自公开播客。逐字稿与总结不用于商业用途。如有侵权请联系移除。
            <span id="admin-footer-link"></span>
          </p>
        </div>
      </footer>
    </>
  );
}

