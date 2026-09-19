"use client";

import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/store/useSession";

import { useDraft } from "./useDraft";

// 正文 + 标签生成区（P3-B）：一次调用同时产出，展示的标签一律是服务端 validateTags 之后的结果。
// 本阶段不做发布预览、不做复制按钮、不做自由编辑。
export function DraftPanel() {
  const selectedTitle = useSession((state) => state.selectedTitle);
  const draft = useSession((state) => state.draft);
  const draftStatus = useSession((state) => state.draftStatus);
  const draftError = useSession((state) => state.draftError);
  const { runDraft } = useDraft();

  // 未选定标题时不展示本区域
  if (!selectedTitle) {
    return null;
  }

  const isGenerating = draftStatus === "loading";
  const tagValidation = draft?.tagValidation;

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">5. 生成正文与标签</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            当前标题：<span className="text-foreground">{selectedTitle}</span>
          </p>
        </div>
        <Button type="button" onClick={() => void runDraft()} disabled={isGenerating}>
          {isGenerating ? "AI 正在写正文…" : draft ? "重新生成正文" : "生成正文"}
        </Button>
      </div>

      {draftError ? <ErrorBanner message={draftError} onRetry={() => void runDraft()} /> : null}

      {draft ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">正文</span>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
              {draft.body}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              标签（服务端校验后的最终结果）
            </span>

            {draft.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {draft.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-muted px-3 py-1 text-xs">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">没有可用的标签。</p>
            )}

            {tagValidation?.changed ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <p>{tagValidation.message ?? "标签已按规则自动修正。"}</p>
                {tagValidation.removed.length > 0 ? (
                  <p className="mt-1">已移除：{tagValidation.removed.join("、")}</p>
                ) : null}
                {tagValidation.dropped.length > 0 ? (
                  <p className="mt-1">已忽略：{tagValidation.dropped.join("、")}</p>
                ) : null}
                {tagValidation.duplicates.length > 0 ? (
                  <p className="mt-1">已合并重复：{tagValidation.duplicates.join("、")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : !isGenerating && !draftError ? (
        <p className="text-sm text-muted-foreground">还没有正文，点击「生成正文」开始。</p>
      ) : null}
    </section>
  );
}
