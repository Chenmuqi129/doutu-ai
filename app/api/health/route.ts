import { NextResponse } from "next/server";

import { getAIProviderStatus } from "@/lib/ai/providers";
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

export async function GET() {
  // 模型配置只有一个来源：lib/ai/providers.ts
  const ai = getAIProviderStatus();

  const data: HealthData = {
    service: SERVICE_NAME,
    product: APP_NAME,
    version: APP_VERSION,
    stage: STAGE,
    node: process.version,
    ai: { ...ai, configured: ai.apiKeyConfigured && ai.baseUrlConfigured },
    timestamp: new Date().toISOString(),
  };

  const body: ApiResponse<HealthData> = { ok: true, data };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
