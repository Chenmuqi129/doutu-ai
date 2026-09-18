import { NextResponse } from "next/server";

import { analyzeMaterial, type AnalyzeImageInput } from "@/lib/ai/tasks/analyze";
import { AppError, ERROR_CODES, toAppError, type ApiErrorBody } from "@/lib/errors";
import {
  IMAGE_ACCEPTED_MIME_TYPES,
  IMAGE_MAX,
  IMAGE_MAX_BYTES,
  IMAGE_MIN,
  UPLOAD_MAX_BYTES,
} from "@/lib/rules/constants";
import type { ApiResponse, MaterialAnalysisResult } from "@/lib/types";

/**
 * POST /api/analyze
 *
 * 职责严格限定为：解析 multipart → 服务端校验 → 调用 analyze task → 统一错误映射 → 返回响应。
 * 本文件不写 Prompt、不写 AI 业务逻辑、不写标题/标签规则。
 *
 * 隐私与安全（P2 §5 / §17）：
 *   - 图片只在内存中转换成 base64 转发给模型，不落磁盘、不写数据库；
 *   - 不把 base64 或 Prompt 写进日志；
 *   - 不信任前端传来的任何校验结果，全部重新校验。
 */

/** 视觉分析耗时较长，给 Serverless 留出足够执行时间。 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const images = await parseAnalyzeRequest(request);
    const data = await analyzeMaterial(images);
    const body: ApiResponse<MaterialAnalysisResult> = { ok: true, data };

    return NextResponse.json(body, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const appError = toAppError(error);
    const body: ApiResponse<never> = { ok: false, error: toPublicErrorBody(appError) };

    return NextResponse.json(body, {
      status: appError.httpStatus,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

/* ------------------------------------------------------------------ *
 * 请求解析与校验
 * ------------------------------------------------------------------ */

async function parseAnalyzeRequest(request: Request): Promise<AnalyzeImageInput[]> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new AppError(ERROR_CODES.INVALID_INPUT, {
      detail: "请求体必须是 multipart/form-data",
    });
  }

  const entries = formData.getAll("images");
  const files = entries.filter((entry): entry is File => isFileLike(entry));

  if (files.length !== entries.length) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "images 字段必须全部是文件" });
  }

  if (files.length < IMAGE_MIN) {
    throw new AppError(ERROR_CODES.NO_IMAGE_UPLOADED);
  }

  if (files.length > IMAGE_MAX) {
    throw new AppError(ERROR_CODES.TOO_MANY_IMAGES);
  }

  const acceptedTypes: readonly string[] = IMAGE_ACCEPTED_MIME_TYPES;
  const images: AnalyzeImageInput[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (!acceptedTypes.includes(file.type)) {
      throw new AppError(ERROR_CODES.UNSUPPORTED_IMAGE_TYPE, {
        detail: `不支持的 MIME 类型：${file.type || "(空)"}`,
      });
    }

    if (file.size === 0) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "存在空文件" });
    }

    if (file.size > IMAGE_MAX_BYTES) {
      throw new AppError(ERROR_CODES.IMAGE_TOO_LARGE, {
        detail: `单张图片 ${file.size} 字节，超过上限`,
      });
    }

    totalBytes += file.size;
    if (totalBytes > UPLOAD_MAX_BYTES) {
      throw new AppError(ERROR_CODES.UPLOAD_TOO_LARGE, { detail: "请求体总体积超过上限" });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({ base64: buffer.toString("base64"), mimeType: file.type });
  }

  return images;
}

function isFileLike(value: unknown): value is File {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<File>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number"
  );
}

/**
 * 生产环境下剥离 detail，避免把内部信息（上游状态码、文件路径等）暴露给前端。
 * 无论哪种环境都不会返回堆栈、Prompt、密钥或图片内容。
 */
function toPublicErrorBody(error: AppError): ApiErrorBody {
  const body = error.toApiErrorBody();

  if (process.env.NODE_ENV === "production" && body.detail !== undefined) {
    return { code: body.code, message: body.message, retryable: body.retryable };
  }

  return body;
}
