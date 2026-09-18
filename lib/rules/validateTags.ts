import { TAG_MAX, TAG_MAX_LENGTH } from "@/lib/rules/constants";
import { countChars, normalizeTag, normalizeText, toDisplayTag } from "@/lib/rules/text";

/**
 * 标签规范化与校验（规格书 §11 + 架构差异报告 M8 / M9）。
 *
 * 职责：
 *   - 去掉重复标签（大小写、全角半角、首尾标点差异都算重复）；
 *   - 统一输出为 #xxx；
 *   - 最多保留 TAG_MAX 个，并如实返回被移除的数量供 UI 提示；
 *   - 保持 AI / 用户原本的标签顺序（先出现的优先保留）。
 *
 * 明确不做：不做相关度评分、不调用 AI、不发网络请求。
 * 纯函数：相同输入永远得到相同输出，返回值可直接序列化给 P3 的 UI 使用。
 */

export type TagValidationResult = {
  /** 最终标签，统一为 #xxx 形式，数量 ≤ max，顺序与输入一致 */
  tags: string[];
  /** 数量上限，取自 TAG_MAX */
  max: number;
  /** 因超过上限被移除的标签（#xxx 形式） */
  removed: string[];
  /** removed.length，UI 直接用来渲染「移除 N 个」 */
  removedCount: number;
  /** 因非法（规范化后为空、或超长）被丢弃的标签，保留原始可见文本便于排查 */
  dropped: string[];
  /** 因重复被合并掉的标签（#xxx 形式） */
  duplicates: string[];
  /** 本次是否发生过任何自动修正，UI 用它决定是否显示提示 */
  changed: boolean;
  /** 可直接展示的提示文案，无修正时为 undefined */
  message?: string;
};

export function validateTags(input: readonly string[]): TagValidationResult {
  const unique: string[] = [];
  const seenKeys = new Set<string>();
  const duplicates: string[] = [];
  const dropped: string[] = [];

  for (const raw of input) {
    const visible = normalizeText(raw);

    // 纯空白输入不是标签，直接忽略（不计入 dropped，也不影响 changed）
    if (visible.length === 0) {
      continue;
    }

    const normalized = normalizeTag(visible);

    // 有内容但规范化后为空，例如「#」「！」，属于无效标签
    if (normalized.length === 0) {
      dropped.push(visible);
      continue;
    }

    // 单标签长度同样走统一的 countChars()
    if (countChars(normalized) > TAG_MAX_LENGTH) {
      dropped.push(normalized);
      continue;
    }

    // 大小写不敏感去重，但保留首次出现时的写法
    const key = normalized.toLowerCase();
    if (seenKeys.has(key)) {
      duplicates.push(toDisplayTag(normalized));
      continue;
    }

    seenKeys.add(key);
    unique.push(normalized);
  }

  const kept = unique.slice(0, TAG_MAX);
  const removed = unique.slice(TAG_MAX).map(toDisplayTag);
  const tags = kept.map(toDisplayTag);

  const notices: string[] = [];
  if (removed.length > 0) {
    notices.push(`已自动保留 ${TAG_MAX} 个标签，移除 ${removed.length} 个`);
  }
  if (dropped.length > 0) {
    notices.push(`已忽略 ${dropped.length} 个无效标签`);
  }
  if (duplicates.length > 0) {
    notices.push(`已合并 ${duplicates.length} 个重复标签`);
  }

  return {
    tags,
    max: TAG_MAX,
    removed,
    removedCount: removed.length,
    dropped,
    duplicates,
    changed: removed.length > 0 || dropped.length > 0 || duplicates.length > 0,
    ...(notices.length > 0 ? { message: `${notices.join("；")}。` } : {}),
  };
}
