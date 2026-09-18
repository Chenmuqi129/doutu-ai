/**
 * 待上传图片的内存登记表。
 *
 * 为什么需要它：
 *   - P0 确认的 SessionImage（lib/types/session.ts）只有元数据，没有 Blob 字段；
 *   - 图片既不能进 localStorage（M14），也不适合塞进 Zustand 的持久化状态；
 *   - 因此用模块级 Map 按 SessionImage.id 暂存压缩后的 Blob，
 *     由上传/删除/重置动作负责登记与释放。
 *
 * 生命周期：随页面会话存在，刷新即清空（与 ObjectURL 一致）。
 */

const uploadRegistry = new Map<string, Blob>();

export function registerUploadBlob(id: string, blob: Blob): void {
  uploadRegistry.set(id, blob);
}

export function getUploadBlob(id: string): Blob | undefined {
  return uploadRegistry.get(id);
}

export function releaseUploadBlob(id: string): void {
  uploadRegistry.delete(id);
}

export function clearUploadBlobs(): void {
  uploadRegistry.clear();
}

/** 当前登记的图片数量，供调试与测试断言使用。 */
export function getRegisteredUploadCount(): number {
  return uploadRegistry.size;
}
