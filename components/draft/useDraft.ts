"use client";

import { useCallback } from "react";

import { ERROR_CODES, ERROR_DESCRIPTORS } from "@/lib/errors";
import { useSession } from "@/lib/store/useSession";
import type { ApiResponse, DraftResponse } from "@/lib/types";

// 「生成正文与标签」动作（P3-B）。
// 成本保护：一次点击只发一个请求，正文与标签由服务端的同一次模型调用产出；
// 不重试、不轮询；这里只读 store 里已有的 analysis / brief / topic / selectedTitle。
export function useDraft() {
  const setDraftStatus = useSession((state) => state.setDraftStatus);
  const applyDraft = useSession((state) => state.applyDraft);

  const runDraft = useCallback(async () => {
    const { topics, selectedTopicId, brief, analysis, selectedTitle, draftStatus } =
      useSession.getState();

    // 防重复点击：上一次还在生成时直接忽略。
    if (draftStatus === "loading") {
      return;
    }

    const topic = topics?.find((item) => item.id === selectedTopicId);

    if (!topic || !brief || !analysis || !selectedTitle) {
      setDraftStatus("error", "请先完成素材分析、选择选题并选定一个标题。");
      return;
    }

    setDraftStatus("loading");

    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, brief, topic, selectedTitle }),
      });
      const payload = (await response.json()) as ApiResponse<DraftResponse>;

      if (!payload.ok) {
        setDraftStatus("error", payload.error.message);
        return;
      }

      applyDraft(payload.data);
    } catch {
      setDraftStatus("error", ERROR_DESCRIPTORS[ERROR_CODES.NETWORK_ERROR].userMessage);
    }
  }, [applyDraft, setDraftStatus]);

  return { runDraft };
}
