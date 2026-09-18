import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "抖图 AI · 抖音图文内容助手",
  description:
    "上传图片，AI 帮你判断适合发什么、怎么写标题、正文和标签，并在发布前自动检查格式。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
