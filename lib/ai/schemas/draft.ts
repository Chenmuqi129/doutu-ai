import { z } from "zod";

import { AnalysisSchema, TopicSchema } from "@/lib/ai/schemas/analyze";
import { BRIEF_MAX } from "@/lib/rules/constants";

/**
 * /api/draft 的请求校验与模型输出校验（P3-B）。
 *
 * 复用原则：
 *   - 请求里的 topic / analysis 直接复用 P2 已导出的 TopicSchema / AnalysisSchema；
 *   - selectedTitle 只做「存在且非空」的形状校验，是否合格由 lib/rules/validateTitle 判定；
 *   - 正文长度由 lib/rules/validateBody 判定，标签由 lib/rules/validateTags 判定，
 *     schema 完全不复制这些业务规则。
 */

/** 前端 → /api/draft 的请求体，与 lib/types 的 DraftRequest 完全一致。 */
export const DraftRequestSchema = z.object({
  analysis: AnalysisSchema,
  // 与 /api/analyze、/api/titles 的 brief 口径保持一致
  brief: z.string().min(1).max(BRIEF_MAX),
  topic: TopicSchema,
  selectedTitle: z.string().min(1),
});

/**
 * 模型给出的正文与标签。
 *
 * - body 只校验形状，长度交给 validateBody（超长不截断，直接判不通过）；
 * - tags 至少 1 个（形状要求），数量上限、# 规范化、去重全部交给 validateTags。
 */
export const DraftAIResponseSchema = z.object({
  body: z.string().min(1),
  tags: z.array(z.string()).min(1),
});

export type DraftRequestPayload = z.infer<typeof DraftRequestSchema>;
export type DraftAIResponsePayload = z.infer<typeof DraftAIResponseSchema>;
