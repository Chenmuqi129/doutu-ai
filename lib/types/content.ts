import type { TitleValidation } from "@/lib/rules/validateTitle";
import type { TagValidationResult } from "@/lib/rules/validateTags";

/**
 * 内容领域模型 —— AI 产出物在前端与后端之间流转的唯一形状。
 */

/** 素材分析结果（规格书 §6）。 */
export type MaterialAnalysis = {
  /** 素材摘要 */
  materialSummary: string;
  /** 视觉 / 内容标签 */
  visualTags: string[];
  /** 可能的受众 */
  audience: string;
};

/**
 * 内容选题（规格书 §7）。
 * 规格书要求至少包含：选题名称、选题说明、内容角度。
 */
export type Topic = {
  id: string;
  /** 选题名称 */
  title: string;
  /** 选题说明 */
  description: string;
  /** 内容角度 */
  angle: string;
  /** 可选增强：钩子句 */
  hook?: string;
  /** 可选增强：推荐理由 */
  reason?: string;
};

/**
 * 标题风格，仅用于展示与多样性控制，不参与规则校验。
 * 用常量数组作为唯一来源，让 Prompt 与 Zod 在运行时也能复用同一份取值。
 */
export const TITLE_STYLES = ["悬念", "干货", "共鸣", "反差", "清单"] as const;

export type TitleStyle = (typeof TITLE_STYLES)[number];

/**
 * 生成后的标题。
 *
 * - 校验信息直接复用 P1 的 TitleValidation（valid / count / max / reason / normalized），
 *   全项目只有这一套字段定义，count 一律由程序计算，绝不采用模型自报的字数；
 * - text 保存规范化后的完整标题，超长时不会被截断，UI 可以如实显示 21 / 20。
 */
export type GeneratedTitle = TitleValidation & {
  text: string;
  style?: TitleStyle;
};

/**
 * 正文 + 标签（规格书 §10 / §11）。
 *
 * tagValidation 直接复用 P1 的 TagValidationResult（tags / removed / dropped /
 * duplicates / changed / message），全项目只有这一套标签字段定义；
 * tags 本身就是 tagValidation.tags，模型原始标签永远不作为可信数据保存。
 */
export type ContentDraft = {
  body: string;
  tags: string[];
  tagValidation?: TagValidationResult;
};

/**
 * /api/analyze 的产出契约。
 *
 * 决策 M6：analysis 与 topics 平级，全项目只允许存在这一套结构，
 * Zod Schema、API Response、TS 类型、Zustand Store、前端组件必须全部一致。
 */
export type MaterialAnalysisResult = {
  analysis: MaterialAnalysis;
  topics: Topic[];
  brief: string;
};
