import { NextResponse } from "next/server";

import type { ApiResponse, HealthData } from "@/lib/types";

/**
 * GET /api/health
 *
 * P0 只做服务自检：确认服务可启动、确认 AI 相关环境变量的配置状态。
 * 不发起任何真实模型调用（P0 明确不接入 AI）。
 *
 * 安全（规格书 §24）：
 *   - 只返回「是否已配置」的布尔值，绝不返回 AI_API_KEY 原文；
 *   - 不返回完整 base URL，只返回是否配置。
 *
 * 说明：Next.js 16 中 route segment config 的 dynamic / revalidate 在启用
 * Cache Components 时已被移除，因此这里不用段配置控制缓存，
 * 改为直接返回 Cache-Control: no-store。
 */

const APP_NAME = "抖图 AI";
const SERVICE_NAME = "douyin-ai-content-assistant";
const APP_VERSION = "0.1.0";
const STAGE = "P0";

/**
 * AI 配置的默认值。
 * P1 会把这部分读取逻辑收敛到 lib/ai/providers.ts，本文件届时改为调用该模块，
 * 以保证「模型配置只有一个来源」。
 */
const AI_DEFAULTS = {
  provider: "dashscope",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  visionModel: "qwen-vl-max",
  textModel: "qwen-plus",
} as const;

export async function GET() {
  const provider = process.env.AI_PROVIDER ?? AI_DEFAULTS.provider;
  const visionModel = process.env.AI_VISION_MODEL ?? AI_DEFAULTS.visionModel;
  const textModel = process.env.AI_TEXT_MODEL ?? AI_DEFAULTS.textModel;
  const apiKeyConfigured = Boolean(process.env.AI_API_KEY);
  const baseUrlConfigured = Boolean(process.env.AI_BASE_URL ?? AI_DEFAULTS.baseUrl);

  const data: HealthData = {
    service: SERVICE_NAME,
    product: APP_NAME,
    version: APP_VERSION,
    stage: STAGE,
    node: process.version,
    ai: {
      provider,
      baseUrlConfigured,
      apiKeyConfigured,
      visionModel,
      textModel,
      configured: apiKeyConfigured && baseUrlConfigured,
    },
    timestamp: new Date().toISOString(),
  };

  const body: ApiResponse<HealthData> = { ok: true, data };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
