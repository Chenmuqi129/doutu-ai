import { TITLE_MAX, TITLE_MIN } from "@/lib/rules/constants";
import { countChars, isPunctuationOnly, normalizeText } from "@/lib/rules/text";

/**
 * 标题校验（规格书 §9 + 架构差异报告 M1）。
 *
 * 核心原则：
 *   - 计数只走 countChars()，本文件不实现第二套计数；
 *   - max 来自 constants.ts 的 TITLE_MAX；
 *   - 超长一律判不通过，**绝不自动截断**：normalized 返回的是去掉首尾空白后的
 *     完整文本，因此 UI 可以如实显示 21/20 并让用户自己改。
 */

/**
 * 不通过的原因。
 * 取值与 lib/errors 中的错误码字符串保持一致，便于路由层直接映射；
 * 但本文件不 import lib/errors —— 避免 rules ↔ errors 形成循环依赖。
 */
export type TitleIssue = "TITLE_EMPTY" | "TITLE_TOO_LONG";

export type TitleValidation = {
  /** 是否满足所有规则，可以直接进入下一步 */
  valid: boolean;
  /** 由 countChars() 计算出的字符数，UI 用它渲染 18/20 */
  count: number;
  /** 允许的最大字符数，取自 TITLE_MAX */
  max: number;
  /** 仅在 valid=false 时出现 */
  reason?: TitleIssue;
  /** 去掉首尾空白与不可见字符后的完整标题，不会被截断 */
  normalized: string;
};

export function validateTitle(input: string): TitleValidation {
  const normalized = normalizeText(input);
  const count = countChars(normalized);
  const max = TITLE_MAX;

  // 空标题，或只由空白与标点组成（例如「。」「！！」）
  if (count < TITLE_MIN || isPunctuationOnly(normalized)) {
    return { valid: false, count, max, reason: "TITLE_EMPTY", normalized };
  }

  if (count > max) {
    return { valid: false, count, max, reason: "TITLE_TOO_LONG", normalized };
  }

  return { valid: true, count, max, normalized };
}
