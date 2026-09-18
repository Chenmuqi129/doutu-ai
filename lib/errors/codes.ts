/**
 * 统一错误码 —— 服务端与前端共用同一套标识。
 *
 * 覆盖规格书 §23 要求至少处理的七种异常场景：
 *   没有上传图片 / 图片超过 9 张 / 图片分析失败 / AI 返回格式错误 /
 *   标题超过 20 字 / 标签超过 5 个 / 网络错误。
 */

export const ERROR_CODES = {
  /** 请求参数缺失或结构不正确 */
  INVALID_INPUT: "INVALID_INPUT",
  /** 没有上传任何图片（规格书 §23） */
  NO_IMAGE_UPLOADED: "NO_IMAGE_UPLOADED",
  /** 图片数量超过 IMAGE_MAX（规格书 §23） */
  TOO_MANY_IMAGES: "TOO_MANY_IMAGES",
  /** 图片格式不在白名单内 */
  UNSUPPORTED_IMAGE_TYPE: "UNSUPPORTED_IMAGE_TYPE",
  /** 单张图片压缩后仍超过 IMAGE_MAX_BYTES */
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  /** 模型服务返回错误或限流（规格书 §23「图片分析失败」） */
  AI_UPSTREAM_ERROR: "AI_UPSTREAM_ERROR",
  /** 模型调用超时 */
  AI_TIMEOUT: "AI_TIMEOUT",
  /** 模型返回内容无法通过 JSON / Zod 校验（规格书 §23「AI 返回格式错误」） */
  AI_INVALID_OUTPUT: "AI_INVALID_OUTPUT",
  /** 浏览器到本站的网络请求失败（规格书 §23「网络错误」） */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** 标题为空或只有标点 */
  TITLE_EMPTY: "TITLE_EMPTY",
  /** 标题超过 TITLE_MAX（规格书 §23「标题超过 20 字」） */
  TITLE_TOO_LONG: "TITLE_TOO_LONG",
  /** 标签超过 TAG_MAX 且无法裁剪（规格书 §23「标签超过 5 个」） */
  TAGS_TOO_MANY: "TAGS_TOO_MANY",
  /** 未归类的服务端异常 */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type AppErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
