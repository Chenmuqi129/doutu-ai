/**
 * 上传数量文案（V0.1 UI 小修）。
 *
 * 之前的「1 / 9」容易被误读成「第 1 步 / 共 9 步」，
 * 这里统一生成「已选 1 / 9 张」，明确表达这是「已选择图片数量」。
 *
 * 没有任何图片时返回 undefined —— 由调用方决定不渲染该文案。
 * 纯函数：不依赖 React / Zustand / 浏览器 API。
 */
export function formatSelectedCount(count: number, max: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) {
    return undefined;
  }

  return `已选 ${Math.trunc(count)} / ${max} 张`;
}
