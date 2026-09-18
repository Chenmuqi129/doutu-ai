import { TAG_PREFIX } from "@/lib/rules/constants";

/**
 * 文本规范化与字符计数 —— 全项目唯一的「字数」实现。
 *
 * 约束（架构差异报告 §8 + P1 要求）：
 *   - 标题、正文、标签长度的所有判断都必须调用 countChars()，
 *     任何模块都不允许再写第二套计数逻辑；
 *   - 所有业务上限（20 / 1200 / 5 …）都来自 lib/rules/constants.ts，
 *     本文件不重复定义；
 *   - 纯函数模块：不访问网络、不调用 AI、不依赖 React / Zustand / 浏览器 API。
 */

/* ------------------------------------------------------------------ *
 * 字符处理工具
 * ------------------------------------------------------------------ */

/**
 * 需要剔除的不可见字符：
 *   软连字符、零宽空格、BOM / 零宽不换行空格，以及除 \t \n \r 以外的控制字符。
 *
 * 刻意不包含 ZWJ(U+200D) 与 ZWNJ(U+200C)——它们是 emoji 组合序列
 * 与部分文字的必要组成部分，剔除会破坏字符本身。
 */
const INVISIBLE_CHARS = /[\u00AD\u200B\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** 全角字符 U+FF01–U+FF5E 与半角 ASCII U+0021–U+007E 的码点差。 */
const FULLWIDTH_TO_HALFWIDTH_OFFSET = 0xfee0;

/** 全角空格 U+3000。 */
const FULLWIDTH_SPACE = /\u3000/g;

/** 标签开头可能出现的 # 前缀（规范化前可能是任意多个）。 */
const LEADING_HASH = /^#+/;

/** 标签内不允许出现的空白。 */
const INNER_WHITESPACE = /\s+/g;

/** 标签首尾需要剔除的标点（中英文常见标点与散落的 #）。 */
const TAG_EDGE_START = /^[#，。、！？；：,.!?;:'"“”‘’（）()【】\[\]《》〈〉「」『』·…~～—]+/;
const TAG_EDGE_END = /[#，。、！？；：,.!?;:'"“”‘’（）()【】\[\]《》〈〉「」『』·…~～—]+$/;

/**
 * 中英文常见标点集合，用于判定「纯标点文本」。
 * 使用显式字符集而非 \p{P}，以保证与 ES2017 target 兼容且行为可预测；
 * emoji 属于符号而非标点，不在集合内（因此「😀」不算空标题）。
 */
const PUNCTUATION_CHARACTERS = new Set(
  "，。、！？；：,.!?;:'\"“”‘’（）()【】[]《》〈〉「」『』·…~～—-_=+/\\|@#$%^&*".split(""),
);

/**
 * 全角 → 半角。
 * 只转换 U+FF01–U+FF5E（全角 ASCII）与全角空格；
 * 中文标点「。」「、」等不在该区间，保持原样。
 */
export function toHalfWidth(input: string): string {
  return input
    .replace(FULLWIDTH_SPACE, " ")
    .replace(/[\uFF01-\uFF5E]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_TO_HALFWIDTH_OFFSET),
    );
}

/**
 * 通用文本规范化 —— 只做「不影响语义」的清理，不改变文字内容本身。
 *
 * 具体行为：
 *   1. 剔除不可见字符（零宽空格、BOM、控制字符等）；
 *   2. 换行统一为 \n（CRLF / CR → LF）；
 *   3. 去掉首尾空白（含全角空格、不换行空格）。
 *
 * 刻意不做的事情：
 *   - 不折叠内部空格（正文中的排版空格属于内容）；
 *   - 不做全角 → 半角（那是标签规范化 normalizeTag 的职责）；
 *   - 不截断（标题超长必须原样返回，交由 UI 提示用户修改）。
 */
export function normalizeText(input: string): string {
  return input.replace(INVISIBLE_CHARS, "").replace(/\r\n?/g, "\n").trim();
}

/**
 * 标签规范化。
 *
 * 处理顺序：全角 → 半角 → 去掉开头的 # → 去掉内部空白 → 去掉首尾标点。
 * 返回结果**不带** # 前缀（前缀由 toDisplayTag 统一添加）。
 */
export function normalizeTag(input: string): string {
  return toHalfWidth(normalizeText(input))
    .replace(LEADING_HASH, "")
    .replace(INNER_WHITESPACE, "")
    .replace(TAG_EDGE_START, "")
    .replace(TAG_EDGE_END, "");
}

/**
 * 把标签转成最终展示 / 复制形式（统一带 # 前缀）。
 * 对已规范化的输入是幂等的；规范化后为空则返回空字符串（不会产生孤立的 "#"）。
 */
export function toDisplayTag(input: string): string {
  const normalized = normalizeTag(input);
  return normalized.length === 0 ? "" : `${TAG_PREFIX}${normalized}`;
}

/**
 * 判断文本是否只由空白与标点组成（即「没有实际内容」）。
 * 供 validateTitle 判定空标题使用。
 */
export function isPunctuationOnly(input: string): boolean {
  const normalized = normalizeText(input);
  if (normalized.length === 0) {
    return true;
  }
  for (const char of normalized) {
    if (char.trim().length === 0) {
      continue;
    }
    if (PUNCTUATION_CHARACTERS.has(char)) {
      continue;
    }
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * 字符计数
 * ------------------------------------------------------------------ */

/**
 * 按「用户感知字符」（grapheme cluster）切分。
 * Intl.Segmenter 在 Node 20+ 与 Chrome 87+ / Safari 14.1+ 均可用；
 * 缺失时回退到按码点计数（此时 ZWJ 组合 emoji 会被算作多个字符）。
 */
function createGraphemeSegmenter(): Intl.Segmenter | null {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
  }
  return null;
}

const graphemeSegmenter = createGraphemeSegmenter();

/**
 * 统一字符计数函数。
 *
 * 计数口径（项目当前采用，见架构差异报告 §8）：
 *   1. 先做 normalizeText（剔除不可见字符、统一换行、去掉首尾空白），
 *      因此首尾空格不计入；
 *   2. 按 grapheme cluster 计数，每个「用户感知字符」记 1：
 *      - 汉字 1 个 = 1；
 *      - 英文字母 1 个 = 1（不区分大小写）；
 *      - 数字 1 个 = 1；
 *      - 标点 1 个 = 1（中英文标点同等对待）；
 *      - emoji 1 个 = 1，含 ZWJ 组合（👨‍👩‍👧）、肤色修饰（👍🏻）、
 *        区域指示符旗标（🇨🇳）均按整体计 1；
 *      - 全角与半角字符都各计 1，不做折算（「Ａ」与「A」同为 1）；
 *   3. 内部空格按 1 计（不折叠），换行按 1 计。
 *
 * 注意：这是本项目内部口径，与抖音发布端是否完全一致仍待实机验证；
 * 口径若有变化，只需修改本函数并跑一遍测试。
 */
export function countChars(input: string): number {
  const normalized = normalizeText(input);
  if (normalized.length === 0) {
    return 0;
  }
  if (graphemeSegmenter !== null) {
    return Array.from(graphemeSegmenter.segment(normalized)).length;
  }
  return Array.from(normalized).length;
}
