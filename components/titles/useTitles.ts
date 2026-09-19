"use client";

import { useCallback } from "react";

import { ERROR_CODES, ERROR_DESCRIPTORS } from "@/lib/errors";
import { useSession } from "@/lib/store/useSession";
import type { ApiResponse, TitlesResponse } from "@/lib/types";

// 「生成标题」动作（P3-A）。
// 成本保护：一次点击只发一个请求，不重试、不轮询；用户再点一次才会再次调用模型。
// 这里只读 store 里已有的 analysis / brief / topic，不会重新调用 /api/analyze。
export function useTitles() {
  const setTitlesStatus = useSession((state) => state.setTitlesStatus);
  const applyTitles = useSession((state) => state.applyTitles);

  const runTitles = useCallback(async () => {
    const { topics, selectedTopicId, brief, analysis, titlesStatus } = useSession.getState();

    // 防重复点击：上一次还在生成时直接忽略。
    if (titlesStatus === "loading") {
      return;
    }

    const topic = topics?.find((item) => item.id === selectedTopicId);

    if (!topic || !brief || !analysis) {
      setTitlesStatus("error", "请先完成素材分析并选择一个选题。");
      return;
    }

    setTitlesStatus("loading");

    try {
      const response = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, brief, topic }),
      });
      const payload = (await response.json()) as ApiResponse<TitlesResponse>;

      if (!payload.ok) {
        setTitlesStatus("error", payload.error.message);
        return;
      }

      applyTitles(payload.data.titles);
    } catch {
      setTitlesStatus("error", ERROR_DESCRIPTORS[ERROR_CODES.NETWORK_ERROR].userMessage);
    }
  }, [applyTitles, setTitlesStatus]);

  return { runTitles };
}
