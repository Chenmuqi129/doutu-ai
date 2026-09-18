"use client";

import { useCallback } from "react";

import { ERROR_CODES, ERROR_DESCRIPTORS } from "@/lib/errors";
import { getUploadBlob } from "@/lib/image/uploadRegistry";
import { IMAGE_MIN } from "@/lib/rules/constants";
import { useSession } from "@/lib/store/useSession";
import type { ApiResponse, MaterialAnalysisResult } from "@/lib/types";

// 「开始分析」动作。成本保护：一次调用只发一个请求，不轮询、不自动重试，
// 用户再点一次才会再次产生模型调用。
export function useAnalyze() {
  const setAnalyzeStatus = useSession((state) => state.setAnalyzeStatus);
  const applyAnalysis = useSession((state) => state.applyAnalysis);

  const runAnalyze = useCallback(async () => {
    const { images } = useSession.getState();

    if (images.length < IMAGE_MIN) {
      setAnalyzeStatus("error", "请先上传至少 1 张图片。");
      return;
    }

    setAnalyzeStatus("loading");

    const formData = new FormData();
    for (const image of images) {
      const blob = getUploadBlob(image.id);
      if (!blob) {
        setAnalyzeStatus("error", "图片已失效，请重新选择图片后再分析。");
        return;
      }
      formData.append("images", blob, image.fileName);
    }

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const payload = (await response.json()) as ApiResponse<MaterialAnalysisResult>;

      if (!payload.ok) {
        setAnalyzeStatus("error", payload.error.message);
        return;
      }

      applyAnalysis(payload.data);
    } catch {
      setAnalyzeStatus("error", ERROR_DESCRIPTORS[ERROR_CODES.NETWORK_ERROR].userMessage);
    }
  }, [applyAnalysis, setAnalyzeStatus]);

  return { runAnalyze };
}
