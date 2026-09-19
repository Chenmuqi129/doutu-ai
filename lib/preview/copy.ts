import { buildPreview, type PreviewPart, type PublishContent } from "@/lib/rules/buildPreview";

/**
 * 复制动作（P3-C）。
 *
 * 文本拼接完全复用 P1 的 buildPreview（标题 / 正文 / 标签 / 全部），
 * 写入剪贴板通过注入的 write 函数完成，便于在 node 环境下测试成功与失败两条路径。
 * 本模块只做复制，不调用 AI、不发网络请求。
 */

/** 复制反馈的展示时长（毫秒），到点后自动消失。 */
export const COPY_FEEDBACK_MS = 2000;

export const COPY_SUCCESS_MESSAGE = "已复制";
export const COPY_FAILURE_MESSAGE = "复制失败，请手动复制";

/** 实际写入剪贴板的动作，由组件注入 navigator.clipboard.writeText。 */
export type CopyWriter = (text: string) => Promise<void>;

export type CopyOutcome = {
  ok: boolean;
  part: PreviewPart;
  /** 本次实际写入的文本，供测试与排查使用 */
  text: string;
  /** 展示给用户的文案；失败时绝不包含浏览器内部错误信息 */
  message: string;
};

export async function copyPreviewPart(
  write: CopyWriter,
  content: PublishContent,
  part: PreviewPart,
): Promise<CopyOutcome> {
  const text = buildPreview(content, part);

  try {
    await write(text);
    return { ok: true, part, text, message: COPY_SUCCESS_MESSAGE };
  } catch {
    return { ok: false, part, text, message: COPY_FAILURE_MESSAGE };
  }
}
