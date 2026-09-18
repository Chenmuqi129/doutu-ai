import type { ContentDraft, GeneratedTitle, MaterialAnalysis, Topic } from "./content";

/**
 * 会话中的图片。
 *
 * 决策 M14：图片只以 ObjectURL 形式存在于内存，绝不进入 localStorage；
 * 页面刷新后 objectUrl 失效，相关 AI 结果必须全部标记为 stale。
 */
export type SessionImage = {
  id: string;
  objectUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

/** 向导步骤（规格书 §5）。 */
export type SessionStep = "upload" | "topics" | "titles" | "draft" | "preview";

/**
 * 过期标记（规格书 §22）。
 *
 * 触发矩阵（架构差异报告 M12）：
 *   重新上传/增删图片 → analysis、topics、titles、draft 全部清空
 *   更换选题        → titles、draft 过期
 *   修改标题        → draft 过期
 */
export type StaleFlags = {
  titles: boolean;
  draft: boolean;
};

/**
 * 允许写入 localStorage 的状态子集 —— 只有文本。
 * 任何新增字段都要先确认它是否可以安全序列化且不含图片数据。
 */
export type PersistedSessionState = {
  analysis?: MaterialAnalysis;
  topics?: Topic[];
  brief?: string;
  selectedTopicId?: string;
  titles?: GeneratedTitle[];
  selectedTitle?: string;
  draft?: ContentDraft;
  step: SessionStep;
  stale: StaleFlags;
};

/**
 * 运行时完整状态 = 可持久化文本 + 内存图片。
 * 类型层面即保证 images 处于持久化范围之外。
 */
export type SessionState = PersistedSessionState & {
  images: SessionImage[];
};
