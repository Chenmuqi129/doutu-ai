/**
 * 图片轮播的纯索引逻辑（P3-C）。
 *
 * 组件只负责渲染，翻页边界、循环与计数文案都在这里算，
 * 便于在 node 环境下直接用单元测试覆盖，不需要 jsdom。
 * 图片本身始终复用 store 里的 SessionImage 顺序，本模块不持有任何图片数据。
 */

/** 把任意索引收敛到 [0, total-1]；total<=0 时返回 0。 */
export function normalizeImageIndex(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) {
    return 0;
  }

  const floored = Math.trunc(index);
  // 用 <= 0 兜住 -0：Object.is(-0, 0) 为 false，索引不该出现负零。
  if (floored <= 0) {
    return 0;
  }
  if (floored > total - 1) {
    return total - 1;
  }
  return floored;
}

/** 在当前索引上前后翻页，越界时首尾循环。 */
export function stepImageIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  const base = normalizeImageIndex(current, total);
  if (!Number.isFinite(delta) || Math.trunc(delta) === 0) {
    return base;
  }

  // 先取模再补一轮，保证结果落在 [0, total) 且不会产生 -0。
  return ((base + Math.trunc(delta)) % total + total) % total;
}

/** 用户可见的计数文案：第 X 张 / 共 Y 张。 */
export function formatImageCounter(index: number, total: number): string {
  if (total <= 0) {
    return "第 0 张 / 共 0 张";
  }
  return `第 ${normalizeImageIndex(index, total) + 1} 张 / 共 ${total} 张`;
}

/** 单图时没有必要显示 carousel 控件。 */
export function hasCarouselControls(total: number): boolean {
  return total > 1;
}
