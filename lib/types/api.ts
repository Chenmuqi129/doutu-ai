import type { ApiErrorBody } from "@/lib/errors";

import type { ContentDraft, GeneratedTitle, MaterialAnalysisResult, Topic } from "./content";

/**
 * 全站统一响应包络。
 * 成功：{ ok: true, data }
 * 失败：{ ok: false, error }
 */
export type ApiSuccess<TData> = {
  ok: true;
  data: TData;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

/** GET /api/health 的返回数据。只暴露「是否已配置」，绝不返回密钥原文。 */
export type HealthData = {
  service: string;
  product: string;
  version: string;
  /** 当前开发阶段，便于验收时确认进度 */
  stage: string;
  node: string;
  ai: {
    provider: string;
    baseUrlConfigured: boolean;
    apiKeyConfigured: boolean;
    visionModel: string;
    textModel: string;
    /** 五项 AI 配置是否已具备发起调用的条件 */
    configured: boolean;
  };
  timestamp: string;
};

/* ------------------------------------------------------------------ *
 * 三次 AI 调用的接口契约（规格书 §19）
 * P0 只声明类型，P2/P3 才实现对应的 route handler。
 * ------------------------------------------------------------------ */

/** POST /api/analyze —— multipart/form-data 上传图片，返回 analysis + topics + brief。 */
export type AnalyzeResponse = MaterialAnalysisResult;

/** POST /api/titles —— 输入 brief + 已选选题，返回 5 个已通过规则校验的标题。 */
export type TitlesRequest = {
  sessionId: string;
  brief: string;
  topic: Topic;
};

export type TitlesResponse = {
  titles: GeneratedTitle[];
};

/** POST /api/draft —— 输入 brief + 选题 + 标题，返回正文与已规范化去重的标签。 */
export type DraftRequest = {
  sessionId: string;
  brief: string;
  topic: Topic;
  title: string;
};

export type DraftResponse = ContentDraft & {
  /** 因超过 TAG_MAX 被程序移除的标签，用于向用户展示「已移除 N 个」提示 */
  tagsRemoved: string[];
};
