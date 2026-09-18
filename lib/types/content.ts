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

/** 标题风格，仅用于展示与多样性控制，不参与规则校验。 */
export type TitleStyle = "悬念" | "干货" | "共鸣" | "反差" | "清单";

/**
 * 生成后的标题。
 * count / valid 一律由程序计算并回填，绝不采用模型自报的字数。
 */
export type GeneratedTitle = {
  text: string;
  style?: TitleStyle;
  count: number;
  valid: boolean;
};

/** 正文 + 标签（规格书 §10 / §11）。 */
export type ContentDraft = {
  body: string;
  tags: string[];
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
