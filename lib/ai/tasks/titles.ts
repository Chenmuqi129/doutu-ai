import { AppError, ERROR_CODES } from "@/lib/errors";
import { validateTitle } from "@/lib/rules/validateTitle";
import type { GeneratedTitle, TitlesRequest, TitlesResponse } from "@/lib/types";

import { getAIClient, toAIError } from "../client";
import { buildTitlesUserText, TITLES_SYSTEM_PROMPT } from "../prompts/titles";
import { getAIConfig } from "../providers";
import { TitlesAIResponseSchema, toTitleStyle } from "../schemas/titles";
import { extractJsonObject } from "./analyze";

/**
 * 标题生成任务：把已选选题 + 素材上下文交给文本模型，产出类型安全的候选标题。
 *
 * 成本约束（与 P2 analyzeMaterial 一致）：
 *   - 整个任务只调用一次模型；
 *   - 不做自动重试、不做循环调用、不做二次润色；
 *   - 解析或校验失败直接抛错，由用户主动点击重新生成。
 *
 * 职责边界：
 *   - 这里只做「调用 + 解析 + 形状校验 + 规则标注」；
 *   - 20 字上限、超长不截断等规则全部来自 lib/rules，本文件不重新实现字数计算。
 */

/** 标题需要一定发散度，取值高于正文类任务。 */
const TITLES_TEMPERATURE = 0.9;

export async function generateTitles(input: TitlesRequest): Promise<TitlesResponse> {
  // 未配置 API Key 时在这里就抛 AI_NOT_CONFIGURED，不会发起任何网络请求
  const config = getAIConfig();
  const client = getAIClient();

  let raw: string | null | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: config.textModel,
      temperature: TITLES_TEMPERATURE,
      messages: [
        { role: "system", content: TITLES_SYSTEM_PROMPT },
        { role: "user", content: buildTitlesUserText(input) },
      ],
    });
    raw = completion.choices[0]?.message?.content;
  } catch (error) {
    throw toAIError(error);
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, { detail: "模型返回内容为空" });
  }

  // 兼容 Markdown 代码块包裹的 JSON，与 P2 使用同一个解析函数
  const json = extractJsonObject(raw);
  const parsed = TitlesAIResponseSchema.safeParse(json);

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

  // 逐条跑 P1 规则：valid / count / max / reason / normalized 全部由程序回填，
  // 模型自报的任何字数或合格标记都会被这里的结果覆盖。
  const titles: GeneratedTitle[] = parsed.data.titles.map((candidate) => {
    const validation = validateTitle(candidate.text);
    const style = toTitleStyle(candidate.style);

    return {
      ...validation,
      text: validation.normalized,
      ...(style ? { style } : {}),
    };
  });

  // 一条合格标题都没有时，这次生成对用户没有任何价值，按 AI 输出异常处理。
  if (!titles.some((title) => title.valid)) {
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, {
      detail: "模型返回的标题均未通过规则校验",
    });
  }

  return { titles };
}
