import type { AppErrorCode } from "./codes";

/**
 * 返回给前端的错误体。
 * message 面向用户（可直接展示），detail 面向开发与日志（不包含密钥与图片内容）。
 */
export type ApiErrorBody = {
  code: AppErrorCode;
  message: string;
  detail?: string;
  retryable: boolean;
};

/** 错误码的静态描述：HTTP 状态码、是否可重试、用户可见文案。 */
export type ErrorDescriptor = {
  httpStatus: number;
  retryable: boolean;
  userMessage: string;
};
