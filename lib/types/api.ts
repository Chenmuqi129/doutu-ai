import type { ApiErrorBody } from "@/lib/errors";
import type { TagValidationResult } from "@/lib/rules/validateTags";

import type {
  ContentDraft,
  GeneratedTitle,
  MaterialAnalysis,
  MaterialAnalysisResult,
  Topic,
} from "./content";

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

/**
 * POST /api/titles —— 输入 analysis + brief + 已选选题，返回 TITLE_COUNT 条候选标题。
 *
 * P0 占位契约里的 sessionId 已移除：全项目没有服务端会话存储，
 * 也不存在 sessionId 的生成点，保留只会变成一个无法满足的必填字段。
 */
export type TitlesRequest = {
  analysis: MaterialAnalysis;
  brief: string;
  topic: Topic;
};

export type TitlesResponse = {
  titles: GeneratedTitle[];
};

/**
 * POST /api/draft —— 输入 analysis + brief + 选题 + 已选标题，
 * 由同一次文本模型调用产出正文与标签。
 *
 * 与 /api/titles 一样不使用 sessionId：服务端无会话存储。
 */
export type DraftRequest = {
  analysis: MaterialAnalysis;
  brief: string;
  topic: Topic;
  /** 用户在标题列表里选中的原始文本，服务端会再次过 validateTitle */
  selectedTitle: string;
};

export type DraftResponse = ContentDraft & {
  /**
   * 本次标签校验的完整结果（removed / dropped / duplicates / changed / message）。
   * 取代 P0 占位契约里的 tagsRemoved —— 那份数据本来就属于 validateTags 的返回值。
   */
  tagValidation: TagValidationResult;
};
