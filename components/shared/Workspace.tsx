"use client";

import { useEffect } from "react";

import { AnalysisResult } from "@/components/analysis/AnalysisResult";
import { DraftPanel } from "@/components/draft/DraftPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { TitlePicker } from "@/components/titles/TitlePicker";
import { TopicPicker } from "@/components/topics/TopicPicker";
import { UploadStep } from "@/components/upload/UploadStep";
import { useSession } from "@/lib/store/useSession";

// 工作区：上传 → 分析 → 选题 → 生成标题 → 生成正文与标签 → 发布预览（P3-C）。
//
// 为什么要等 mount：Zustand persist 会在客户端同步读取 localStorage，
// 直接渲染会和服务端首屏 HTML 不一致（hydration mismatch），
// 因此首帧只渲染占位内容，挂载后再显示真实会话状态。
export function Workspace() {
  // persist 配置了 skipHydration，挂载后手动恢复本地文本状态。
  // 首屏因此与 SSR 完全一致，不会出现 hydration mismatch。
  useEffect(() => {
    void useSession.persist.rehydrate();
  }, []);

  return <WorkspaceBody />;
}

function WorkspaceBody() {
  const stale = useSession((state) => state.stale);

  const hasStaleContent = stale.titles || stale.draft;

  return (
    <div className="flex flex-col gap-6">
      <UploadStep />

      {hasStaleContent ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          上游内容已修改，之前生成的标题 / 正文 / 标签已作废，需要重新生成。
        </p>
      ) : null}

      <AnalysisResult />
      <TopicPicker />
      <TitlePicker />
      <DraftPanel />
      <PreviewPanel />
    </div>
  );
}
