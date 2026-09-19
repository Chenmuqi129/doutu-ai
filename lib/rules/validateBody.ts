import { BODY_MAX, BODY_MIN } from "@/lib/rules/constants";
import { countChars, isPunctuationOnly, normalizeText } from "@/lib/rules/text";

/**
 * 正文校验（规格书 §10）。
 *
 * 与 validateTitle 保持完全一致的口径：
 *   - 计数只走 countChars()，本文件不实现第二套计数；
 *   - 下限/上限来自 constants.ts 的 BODY_MIN / BODY_MAX，任何调用方都不许再写 20 / 1200；
 *   - 超长一律判不通过，**绝不自动截断**：normalized 返回完整正文，由调用方决定怎么处理。
 *
 * reason 只是规则层标识（与 lib/errors 的错误码无关），由调用方映射成统一的 AppError。
 */

export type BodyIssue = "BODY_EMPTY" | "BODY_TOO_SHORT" | "BODY_TOO_LONG";

export type BodyValidation = {
  /** 是否满足全部正文规则 */
  valid: boolean;
  /** 由 countChars() 计算出的字符数 */
  count: number;
  /** 允许的最小字符数，取自 BODY_MIN */
  min: number;
  /** 允许的最大字符数，取自 BODY_MAX */
  max: number;
  /** 仅在 valid=false 时出现 */
  reason?: BodyIssue;
  /** 去掉首尾空白与不可见字符后的完整正文，不会被截断 */
  normalized: string;
};

export function validateBody(input: string): BodyValidation {
  const normalized = normalizeText(input);
  const count = countChars(normalized);
  const min = BODY_MIN;
  const max = BODY_MAX;

  // 空正文、纯空白、纯标点都视为「没有实际内容」
  if (count === 0 || isPunctuationOnly(normalized)) {
    return { valid: false, count, min, max, reason: "BODY_EMPTY", normalized };
  }

  if (count < min) {
    return { valid: false, count, min, max, reason: "BODY_TOO_SHORT", normalized };
  }

  if (count > max) {
    return { valid: false, count, min, max, reason: "BODY_TOO_LONG", normalized };
  }

  return { valid: true, count, min, max, normalized };
}
