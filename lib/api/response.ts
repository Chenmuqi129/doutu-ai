import { NextResponse } from "next/server";

import type { ApiErrorBody, AppError } from "@/lib/errors";
import type { ApiResponse } from "@/lib/types";

/**
 * API 路由的统一响应出口（P3-A 新增）。
 *
 * 与 P2 /api/analyze 的返回格式完全一致（{ ok, data } / { ok, error } + Cache-Control: no-store），
 * 只是抽成共享函数，避免 P3 每个新路由再复制一份错误映射。
 * 本文件不修改 P2 的任何 route 实现。
 */

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function apiSuccess<TData>(data: TData): NextResponse {
  const body: ApiResponse<TData> = { ok: true, data };
  return NextResponse.json(body, { status: 200, headers: NO_STORE_HEADERS });
}

export function apiFailure(error: AppError): NextResponse {
  const body: ApiResponse<never> = { ok: false, error: toPublicErrorBody(error) };
  return NextResponse.json(body, { status: error.httpStatus, headers: NO_STORE_HEADERS });
}

/**
 * 生产环境下剥离 detail，避免把内部信息（上游状态码、字段路径等）暴露给前端。
 * 无论哪种环境都不会返回堆栈、Prompt、密钥或图片内容。
 */
export function toPublicErrorBody(error: AppError): ApiErrorBody {
  const body = error.toApiErrorBody();

  if (process.env.NODE_ENV === "production" && body.detail !== undefined) {
    return { code: body.code, message: body.message, retryable: body.retryable };
  }

  return body;
}
