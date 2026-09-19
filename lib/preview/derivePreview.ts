import { normalizeText } from "@/lib/rules/text";
import type { ContentDraft, SessionImage } from "@/lib/types";

/**
 * 发布预览的数据派生（P3-C）。
 *
 * 预览不保存任何自己的状态：每次渲染都从 store 当前数据现算，
 * 因此换标题 / 重新生成正文 / 重新分析图片之后，预览一定跟着变，
 * 不会出现「标题已经变了但预览还是旧标题」这类问题。
 *
 * 本模块是纯函数：不调用 AI、不发网络请求、不碰浏览器 API。
 */

export type PreviewSource = {
  images: SessionImage[];
  selectedTitle?: string;
  draft?: ContentDraft;
};

export type PreviewContent = {
  title: string;
  body: string;
  /** 服务端 validateTags 之后的最终标签（#xxx） */
  tags: string[];
};

/**
 * 只有在 images / selectedTitle / draft.body / draft.tags 都齐备时才返回内容，
 * 否则返回 undefined，由调用方决定不渲染预览。
 */
export function derivePreviewContent(source: PreviewSource): PreviewContent | undefined {
  const { images, selectedTitle, draft } = source;

  if (images.length === 0) {
    return undefined;
  }

  if (!draft || !Array.isArray(draft.tags)) {
    return undefined;
  }

  const title = normalizeText(selectedTitle ?? "");
  const body = normalizeText(draft.body);

  if (title.length === 0 || body.length === 0) {
    return undefined;
  }

  return { title, body, tags: draft.tags };
}
