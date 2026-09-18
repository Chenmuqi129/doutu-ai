import { ERROR_CODES, type AppErrorCode } from "./codes";
import { ERROR_DESCRIPTORS } from "./messages";
import type { ApiErrorBody } from "./types";

export * from "./codes";
export * from "./messages";
export * from "./types";
export { AppError, isAppError, toAppError };

/**
 * 应用级错误。
 *
 * 用法：在 route handler 或 AI 任务中 `throw new AppError(ERROR_CODES.AI_TIMEOUT)`，
 * 由路由层统一转成 { ok: false, error } 响应，避免各接口各写一套错误格式。
 */
class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly detail?: string;

  constructor(code: AppErrorCode, options: { detail?: string; cause?: unknown } = {}) {
    const descriptor = ERROR_DESCRIPTORS[code];
    super(descriptor.userMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = descriptor.httpStatus;
    this.retryable = descriptor.retryable;
    this.userMessage = descriptor.userMessage;
    this.detail = options.detail;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  toApiErrorBody(): ApiErrorBody {
    return {
      code: this.code,
      message: this.userMessage,
      retryable: this.retryable,
      ...(this.detail ? { detail: this.detail } : {}),
    };
  }
}

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 把任意异常收敛成 AppError，保证路由层只有一种错误出口。
 * detail 只保留异常 message，不记录请求体、密钥或图片内容。
 */
function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new AppError(ERROR_CODES.INTERNAL_ERROR, { detail, cause: error });
}
