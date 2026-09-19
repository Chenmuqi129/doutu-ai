import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "抖图 AI · 抖音图文内容助手",
  description:
    "上传图片，AI 帮你判断适合发什么、怎么写标题、正文和标签，并在发布前自动检查格式。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 高度交给内容决定：html / body 都不再设 h-full / min-h-full，
    // 内容少时页面自然收口，不再被强行撑满一屏。
    <html lang="zh-CN" className="antialiased">
      <body className="flex flex-col">{children}</body>
    </html>
  );
}
