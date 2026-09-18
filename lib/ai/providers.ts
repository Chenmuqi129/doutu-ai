import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * AI 供应商配置（P0 已确定的 DashScope / Qwen 方案）。
 *
 * 约束：
 *   - 只读取服务端环境变量，绝不使用 NEXT_PUBLIC_ 前缀；
 *   - 密钥只在服务端进程内使用，不出现在任何响应、日志或客户端代码里；
 *   - 本文件不 import 任何 SDK，保证 /api/health 之类的调用方可以轻量引用。
 */

export type AIProviderConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  textModel: string;
  timeoutMs: number;
  maxRetries: number;
};

export type AIProviderStatus = {
  provider: string;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  visionModel: string;
  textModel: string;
  configured: boolean;
};

const AI_DEFAULTS = {
  provider: "dashscope",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  visionModel: "qwen-vl-max",
  textModel: "qwen-plus",
} as const;

/**
 * 单次模型调用超时。
 * 它属于 AI 配置而非业务规则，因此不放进 lib/rules/constants.ts
 * （那个文件的定位是标题 / 标签 / 正文 / 图片等业务规则上限）。
 */
export const AI_TIMEOUT_MS = 45_000;

/**
 * 成本保护：SDK 默认会自动重试，会造成一次点击产生多次请求。
 * 这里固定为 0 —— 一次用户点击最多产生一次模型调用。
 */
export const AI_MAX_RETRIES = 0;

/** 供 /api/health 与前端使用的配置状态，只暴露「是否已配置」，不含密钥。 */
export function getAIProviderStatus(): AIProviderStatus {
  const apiKeyConfigured = Boolean(process.env.AI_API_KEY);
  const baseUrl = process.env.AI_BASE_URL ?? AI_DEFAULTS.baseUrl;

  return {
    provider: process.env.AI_PROVIDER ?? AI_DEFAULTS.provider,
    baseUrlConfigured: Boolean(baseUrl),
    apiKeyConfigured,
    visionModel: process.env.AI_VISION_MODEL ?? AI_DEFAULTS.visionModel,
    textModel: process.env.AI_TEXT_MODEL ?? AI_DEFAULTS.textModel,
    configured: apiKeyConfigured,
  };
}

/**
 * 读取完整配置。缺少 API Key 时抛 AI_NOT_CONFIGURED，
 * 由路由层统一转成 503 + 可读提示，不会 crash。
 */
export function getAIConfig(): AIProviderConfig {
  const status = getAIProviderStatus();
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new AppError(ERROR_CODES.AI_NOT_CONFIGURED);
  }

  return {
    provider: status.provider,
    baseUrl: process.env.AI_BASE_URL ?? AI_DEFAULTS.baseUrl,
    apiKey,
    visionModel: status.visionModel,
    textModel: status.textModel,
    timeoutMs: AI_TIMEOUT_MS,
    maxRetries: AI_MAX_RETRIES,
  };
}
