import { apiFailure, apiSuccess } from "@/lib/api/response";
import { DraftRequestSchema } from "@/lib/ai/schemas/draft";
import { generateDraft } from "@/lib/ai/tasks/draft";
import { AppError, ERROR_CODES, toAppError } from "@/lib/errors";
import { validateTitle } from "@/lib/rules/validateTitle";
import type { DraftRequest } from "@/lib/types";

/**
 * POST /api/draft
 *
 * 职责严格限定为：解析 JSON → 服务端重新校验 → 标题闸门 → 调用 draft task → 统一错误映射。
 * 本文件不写 Prompt、不做正文 / 标签 / 字数的规则实现，全部复用 lib/rules。
 *
 * 成本约束：
 *   - 前置校验（含 selectedTitle）全部通过后才会调用模型；
 *   - 一次请求最多触发一次文本模型调用，无自动重试、无轮询。
 */

/** 与 P2 / P3-A 保持一致，给 Serverless 留出足够执行时间。 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = await parseDraftRequest(request);
    const title = validateTitle(input.selectedTitle);

    // 标题闸门：不合格标题绝不能进入正文生成，且此时 0 次模型调用。
    if (!title.valid) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, {
        detail: `selectedTitle 未通过校验：${title.reason ?? "unknown"}`,
      });
    }

    // 交给模型的是规范化后的标题（去掉首尾空白与不可见字符）
    const data = await generateDraft({ ...input, selectedTitle: title.normalized });

    return apiSuccess(data);
  } catch (error) {
    return apiFailure(toAppError(error));
  }
}

/**
 * 请求体解析。
 * 不信任前端传来的任何内容：analysis / brief / topic / selectedTitle 全部重新过一遍 Zod。
 */
async function parseDraftRequest(request: Request): Promise<DraftRequest> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "请求体必须是 JSON" });
  }

  const parsed = DraftRequestSchema.safeParse(json);

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
