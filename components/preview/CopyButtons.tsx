"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COPY_FAILURE_MESSAGE,
  COPY_FEEDBACK_MS,
  COPY_SUCCESS_MESSAGE,
  copyPreviewPart,
} from "@/lib/preview/copy";
import type { PreviewPart, PublishContent } from "@/lib/rules/buildPreview";

// 四个复制按钮（P3-C）：标题 / 正文 / 标签 / 全部。
// 只使用浏览器 Clipboard API，不引入任何第三方依赖；不调用 AI、不发网络请求。
const COPY_BUTTONS: { part: PreviewPart; label: string; primary?: boolean }[] = [
  { part: "all", label: "一键复制全部", primary: true },
  { part: "title", label: "复制标题" },
  { part: "body", label: "复制正文" },
  { part: "tags", label: "复制标签" },
];

/** 真实写入剪贴板；非安全上下文或浏览器不支持时直接失败，由调用方给出统一提示。 */
async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("clipboard api unavailable");
  }
  await navigator.clipboard.writeText(text);
}

export function CopyButtons({ content }: { content: PublishContent }) {
  const [feedback, setFeedback] = useState<{ part: PreviewPart; ok: boolean } | undefined>(
    undefined,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 反馈是短暂的：离开页面时清掉定时器，避免泄漏。
  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(part: PreviewPart) {
    const outcome = await copyPreviewPart(writeToClipboard, content, part);

    setFeedback({ part, ok: outcome.ok });

    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setFeedback(undefined), COPY_FEEDBACK_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {COPY_BUTTONS.map((button) => (
          <Button
            key={button.part}
            type="button"
            size="sm"
            variant={button.primary ? "default" : "outline"}
            onClick={() => void handleCopy(button.part)}
          >
            {feedback?.part === button.part && feedback.ok
              ? COPY_SUCCESS_MESSAGE
              : button.label}
          </Button>
        ))}
      </div>

      {feedback ? (
        <p
          role="status"
          className={
            feedback.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"
          }
        >
          {feedback.ok ? COPY_SUCCESS_MESSAGE : COPY_FAILURE_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
