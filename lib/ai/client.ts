import OpenAI from "openai";

import { AppError, ERROR_CODES } from "@/lib/errors";

import { getAIConfig } from "./providers";

/**
 * OpenAI 兼容客户端 —— 全项目唯一的模型网络出口。
 *
 * 关键设置：
 *   - maxRetries = 0：SDK 默认会自动重试，会造成不可控的重复计费，
 *     这里关闭，保证「一次用户点击 = 最多一次模型请求」；
 *   - timeout：见 providers.ts；
 *   - 客户端按 API Key 缓存复用，避免每次请求重建连接池。
 */

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

export function getAIClient(): OpenAI {
  const config = getAIConfig();

  if (cachedClient === null || cachedApiKey !== config.apiKey) {
    cachedClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
    cachedApiKey = config.apiKey;
  }

  return cachedClient;
}

/**
 * 把 SDK 抛出的异常收敛成 AppError。
 *
 * detail 只保留状态码与异常名，绝不包含 prompt、图片 base64 或密钥。
 */
export function toAIError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new AppError(ERROR_CODES.AI_TIMEOUT, { detail: "上游连接超时" });
  }

  if (error instanceof OpenAI.APIUserAbortError) {
    return new AppError(ERROR_CODES.AI_TIMEOUT, { detail: "请求被中断" });
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new AppError(ERROR_CODES.NETWORK_ERROR, { detail: "无法连接上游模型服务" });
  }

  if (error instanceof OpenAI.APIError) {
    return new AppError(ERROR_CODES.AI_UPSTREAM_ERROR, {
      detail: `上游返回 status=${error.status ?? "unknown"}`,
    });
  }

  return new AppError(ERROR_CODES.AI_UPSTREAM_ERROR, { detail: "模型调用失败" });
}
