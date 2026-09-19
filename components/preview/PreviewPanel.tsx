"use client";

import { derivePreviewContent } from "@/lib/preview/derivePreview";
import { useSession } from "@/lib/store/useSession";

import { CopyButtons } from "./CopyButtons";
import { ImageCarousel } from "./ImageCarousel";

// 发布预览（P3-C）：V0.1 的最终结果区域。
//
// 数据全部来自 store 当前值（images / selectedTitle / draft），
// 不额外保存一份 preview 状态，也不产生任何 AI 调用。
export function PreviewPanel() {
  const images = useSession((state) => state.images);
  const selectedTitle = useSession((state) => state.selectedTitle);
  const draft = useSession((state) => state.draft);

  const preview = derivePreviewContent({ images, selectedTitle, draft });

  if (!preview) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">6. 发布预览</h2>
        <p className="text-sm text-muted-foreground">
          这就是可以直接复制出去发布的内容，标题、正文、标签都取自当前有效结果。
        </p>
      </div>

      {/* 模拟抖音图文笔记的阅读结构：图片 → 标题 → 正文 → 标签 */}
      <article className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border bg-background p-4">
        <ImageCarousel images={images} />

        <h3 className="font-heading text-lg leading-snug font-semibold">{preview.title}</h3>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{preview.body}</p>

        {preview.tags.length > 0 ? (
          <p className="text-sm text-sky-600 dark:text-sky-400">{preview.tags.join(" ")}</p>
        ) : null}
      </article>

      <CopyButtons content={preview} />
    </section>
  );
}
