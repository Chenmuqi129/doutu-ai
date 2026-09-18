import { normalizeText, toDisplayTag } from "@/lib/rules/text";

/**
 * 发布预览 / 复制文本构建（规格书 §12 / §13）。
 *
 * 纯函数：不调用浏览器 API（不碰 navigator.clipboard）、不调用 AI、不发网络请求。
 * 只负责把内容拼成字符串，P3 的复制按钮拿到字符串后自行决定怎么写入剪贴板。
 *
 * 拼接格式说明（规格书未规定，此处采用最简单稳定可读的方案）：
 *   - 标签之间用单个空格分隔（与抖音话题输入习惯一致）；
 *   - 「复制全部」= 标题 + 空行 + 正文 + 空行 + 标签，空缺的段落自动省略。
 */

export type PublishContent = {
  title?: string;
  body?: string;
  tags?: readonly string[];
};

/** 四种复制目标。 */
export const PREVIEW_PARTS = ["title", "body", "tags", "all"] as const;
export type PreviewPart = (typeof PREVIEW_PARTS)[number];

/** 只复制标题。 */
export function buildTitleText(content: PublishContent): string {
  return normalizeText(content.title ?? "");
}

/** 只复制正文（保留段落换行，只去掉首尾空白）。 */
export function buildBodyText(content: PublishContent): string {
  return normalizeText(content.body ?? "");
}

/**
 * 只复制标签。
 * 这里会再走一次 toDisplayTag，保证输出一定是 #xxx 形式，
 * 即使调用方传入的是未规范化的原始标签（例如 AI 直接返回的「美食」）。
 */
export function buildTagsText(content: PublishContent): string {
  return (content.tags ?? [])
    .map(toDisplayTag)
    .filter((tag) => tag.length > 0)
    .join(" ");
}

/** 一键复制全部：标题 + 空行 + 正文 + 空行 + 标签，空缺部分自动省略。 */
export function buildAllText(content: PublishContent): string {
  return [buildTitleText(content), buildBodyText(content), buildTagsText(content)]
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/** 四种构建器的统一查表，保证 buildPreview 的分发不会遗漏分支。 */
export const PREVIEW_BUILDERS: Record<PreviewPart, (content: PublishContent) => string> = {
  title: buildTitleText,
  body: buildBodyText,
  tags: buildTagsText,
  all: buildAllText,
};

/** 统一入口：buildPreview(content, "title" | "body" | "tags" | "all")。 */
export function buildPreview(content: PublishContent, part: PreviewPart = "all"): string {
  return PREVIEW_BUILDERS[part](content);
}
