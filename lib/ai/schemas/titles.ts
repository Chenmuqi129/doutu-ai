import { z } from "zod";

import { AnalysisSchema, TopicSchema } from "@/lib/ai/schemas/analyze";
import { BRIEF_MAX, TITLE_COUNT } from "@/lib/rules/constants";
import { TITLE_STYLES, type TitleStyle } from "@/lib/types";

/**
 * /api/titles 的请求校验与模型输出校验（P3-A）。
 *
 * 复用原则：
 *   - 请求里的 topic / analysis 直接复用 P2 已导出的 TopicSchema / AnalysisSchema，
 *     不重复定义已有结构；
 *   - 标题「是否合格」「多少字」一律由 lib/rules/validateTitle 判定，
 *     本文件只负责「模型是否按约定形状返回」，不复制任何字数规则。
 */

/** 前端 → /api/titles 的请求体，与 lib/types 的 TitlesRequest 完全一致。 */
export const TitlesRequestSchema = z.object({
  analysis: AnalysisSchema,
  // 与 /api/analyze 的 brief 口径保持一致（BRIEF_MAX）
  brief: z.string().min(1).max(BRIEF_MAX),
  topic: TopicSchema,
});

/**
 * 模型给出的单条候选标题。
 *
 * text 刻意不设长度限制：超长属于业务规则问题，交给 validateTitle 判定后如实返回，
 * 绝不在 schema 层截断或悄悄丢弃。style 仅用于展示，未知取值会被降级为 undefined。
 */
export const TitleCandidateSchema = z.object({
  text: z.string(),
  style: z.string().optional(),
});

/** 模型原始输出：必须恰好 TITLE_COUNT 条候选标题。 */
export const TitlesAIResponseSchema = z.object({
  titles: z.array(TitleCandidateSchema).length(TITLE_COUNT),
});

/** 把模型给的 style 收敛到既定的标题风格；未知值降级为 undefined。 */
export function toTitleStyle(value: string | undefined): TitleStyle | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const styles: readonly string[] = TITLE_STYLES;
  return styles.includes(value) ? (value as TitleStyle) : undefined;
}

export type TitlesRequestPayload = z.infer<typeof TitlesRequestSchema>;
export type TitlesAIResponsePayload = z.infer<typeof TitlesAIResponseSchema>;
