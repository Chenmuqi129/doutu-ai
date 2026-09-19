import { AppError, ERROR_CODES } from "@/lib/errors";
import { validateBody } from "@/lib/rules/validateBody";
import { validateTags } from "@/lib/rules/validateTags";
import type { DraftRequest, DraftResponse } from "@/lib/types";

import { getAIClient, toAIError } from "../client";
import { buildDraftUserText, DRAFT_SYSTEM_PROMPT } from "../prompts/draft";
import { getAIConfig } from "../providers";
import { DraftAIResponseSchema } from "../schemas/draft";
import { extractJsonObject } from "./analyze";

/**
 * 正文 + 标签生成任务：一次模型调用同时产出 body 与 tags。
 *
 * 成本约束（与 P2/P3-A 一致）：
 *   - 整个任务只调用一次模型，正文与标签绝不拆成两次请求；
 *   - 不做自动重试、不做循环调用、不做二次润色；
 *   - 解析或校验失败直接抛错，由用户主动点击重新生成。
 *
 * 职责边界：
 *   - 这里只做「调用 + 解析 + 形状校验 + 交给规则层判定」；
 *   - 正文长度走 validateBody，标签走 validateTags，本文件不重新实现任何规则。
 */

/** 正文与标签属于收敛型任务，温度低于标题生成。 */
const DRAFT_TEMPERATURE = 0.7;

export async function generateDraft(input: DraftRequest): Promise<DraftResponse> {
  // 未配置 API Key 时在这里就抛 AI_NOT_CONFIGURED，不会发起任何网络请求
  const config = getAIConfig();
  const client = getAIClient();

  let raw: string | null | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: config.textModel,
      temperature: DRAFT_TEMPERATURE,
      messages: [
        { role: "system", content: DRAFT_SYSTEM_PROMPT },
        { role: "user", content: buildDraftUserText(input) },
      ],
    });
    raw = completion.choices[0]?.message?.content;
  } catch (error) {
    throw toAIError(error);
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, { detail: "模型返回内容为空" });
  }

  // 兼容 Markdown 代码块包裹的 JSON，与 P2 / P3-A 使用同一个解析函数
  const json = extractJsonObject(raw);
  const parsed = DraftAIResponseSchema.safeParse(json);

  if (!parsed.success) {
    // detail 只记录出错字段路径，不记录模型原文
    const paths = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .slice(0, 6)
      .join("、");
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, {
      detail: `字段校验失败：${paths}`,
    });
  }

  // 正文：长度口径只认 validateBody，模型自报的长度一律不采信
  const bodyValidation = validateBody(parsed.data.body);

  if (!bodyValidation.valid) {
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, {
      detail: `正文未通过规则校验：${bodyValidation.reason ?? "unknown"}`,
    });
  }

  // 标签：规范化、去重、上限裁剪与提示文案全部由 validateTags 产出
  const tagValidation = validateTags(parsed.data.tags);

  return {
    body: bodyValidation.normalized,
    tags: tagValidation.tags,
    tagValidation,
  };
}
