import { apiFailure, apiSuccess } from "@/lib/api/response";
import { TitlesRequestSchema } from "@/lib/ai/schemas/titles";
import { generateTitles } from "@/lib/ai/tasks/titles";
import { AppError, ERROR_CODES, toAppError } from "@/lib/errors";
import type { TitlesRequest } from "@/lib/types";

/**
 * POST /api/titles
 *
 * 职责严格限定为：解析 JSON → 服务端重新校验 → 调用 titles task → 统一错误映射。
 * 本文件不写 Prompt、不做标题字数校验（那是 lib/rules/validateTitle 的职责）。
 *
 * 成本约束：一次请求最多触发一次文本模型调用，无自动重试、无轮询。
 */

/** 与 P2 视觉分析保持一致，给 Serverless 留出足够执行时间。 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = await parseTitlesRequest(request);
    const data = await generateTitles(input);

    return apiSuccess(data);
  } catch (error) {
    return apiFailure(toAppError(error));
  }
}

/**
 * 请求体解析。
 * 不信任前端传来的任何内容：brief / topic / analysis 全部重新过一遍 Zod。
 */
async function parseTitlesRequest(request: Request): Promise<TitlesRequest> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "请求体必须是 JSON" });
  }

  const parsed = TitlesRequestSchema.safeParse(json);

  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .slice(0, 6)
      .join("、");
    throw new AppError(ERROR_CODES.INVALID_INPUT, {
      detail: `字段校验失败：${paths}`,
    });
  }

  return parsed.data;
}
