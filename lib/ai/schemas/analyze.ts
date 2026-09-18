import { z } from "zod";

import { BRIEF_MAX, TOPIC_COUNT } from "@/lib/rules/constants";

/**
 * /api/analyze 的模型输出校验（P2）。
 *
 * 契约与 lib/types/content.ts 的 MaterialAnalysisResult 完全一致：
 * analysis 与 topics 平级（决策 M6）。
 *
 * 原则：严格校验，不为了让结果「通过」而修改模型输出。
 * 字段缺失或类型不符一律判定为 AI_INVALID_OUTPUT，由用户主动重试。
 */

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  angle: z.string().min(1),
  // 可选增强字段：lib/types 的 Topic 里已预留，模型给了就保留
  hook: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

export const AnalysisSchema = z.object({
  materialSummary: z.string().min(1),
  visualTags: z.array(z.string().min(1)).min(1),
  audience: z.string().min(1),
});

export const AnalyzeResponseSchema = z.object({
  analysis: AnalysisSchema,
  // 必须恰好 TOPIC_COUNT 个，且 id 不能重复（重复会导致选题选择不可用）
  topics: z
    .array(TopicSchema)
    .length(TOPIC_COUNT)
    .refine(
      (topics) => new Set(topics.map((topic) => topic.id)).size === topics.length,
      { message: "topics 的 id 必须互不相同" },
    ),
  // brief 会被回传到后续接口，长度上限与 BRIEF_MAX 保持一致（成本保护）
  brief: z.string().min(1).max(BRIEF_MAX),
});

export type AnalyzeResponsePayload = z.infer<typeof AnalyzeResponseSchema>;
