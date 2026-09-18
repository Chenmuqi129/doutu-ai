import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  IMAGE_ACCEPTED_MIME_TYPES,
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
} from "@/lib/rules/constants";

/**
 * 客户端图片压缩（P2 §4）。
 *
 * 目的：
 *   1. 把长边缩放到 IMAGE_MAX_EDGE 以内，直接降低视觉模型的 token 成本；
 *   2. 统一输出 JPEG，缩小请求体体积；
 *   3. 压缩后仍超过 IMAGE_MAX_BYTES 则拒绝并提示，不做静默降质循环。
 *
 * 所有上限都取自 lib/rules/constants.ts，本文件不定义第二套限制。
 * 压缩结果只存在于浏览器内存中（Blob + ObjectURL），不写入 localStorage。
 */

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
};

/** 统一输出格式：JPEG（视觉模型与抖音都友好，且体积可控）。 */
const OUTPUT_MIME_TYPE = "image/jpeg";

/** 上传前的格式检查，白名单来自 constants.ts。 */
export function isAcceptedImageType(mimeType: string): boolean {
  return (IMAGE_ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * 计算缩放后的目标尺寸：长边不超过 maxEdge，且不放大小图。
 * 纯函数，便于单测覆盖边界。
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = IMAGE_MAX_EDGE,
): { width: number; height: number; scale: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "图片尺寸不合法" });
  }

  const longestEdge = Math.max(width, height);
  const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/** 压缩一张图片，失败时抛出 AppError（由调用方决定如何提示）。 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_IMAGE_TYPE);
  }

  if (file.size === 0) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "图片内容为空" });
  }

  const bitmap = await loadBitmap(file);

  try {
    const target = computeTargetSize(bitmap.width, bitmap.height);
    const blob = await renderToJpeg(bitmap, target.width, target.height);

    if (blob.size > IMAGE_MAX_BYTES) {
      throw new AppError(ERROR_CODES.IMAGE_TOO_LARGE, {
        detail: `压缩后仍为 ${blob.size} 字节`,
      });
    }

    return {
      blob,
      width: target.width,
      height: target.height,
      sizeBytes: blob.size,
      mimeType: blob.type || OUTPUT_MIME_TYPE,
    };
  } finally {
    closeBitmap(bitmap);
  }
}

/* ------------------------------------------------------------------ *
 * 浏览器能力封装
 * ------------------------------------------------------------------ */

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "无法读取图片内容" });
  }
}

async function renderToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context) {
      paint(context, bitmap, width, height);
      return await canvas.convertToBlob({
        type: OUTPUT_MIME_TYPE,
        quality: IMAGE_JPEG_QUALITY,
      });
    }
  }

  // 回退路径：部分浏览器没有 OffscreenCanvas.convertToBlob
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, { detail: "当前浏览器不支持图片压缩" });
  }

  paint(context, bitmap, width, height);
  return await canvasToBlob(canvas);
}

function paint(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
): void {
  // JPEG 没有透明通道，先铺白底，避免 PNG 透明区域变成黑块
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new AppError(ERROR_CODES.INVALID_INPUT, { detail: "图片压缩失败" }));
        }
      },
      OUTPUT_MIME_TYPE,
      IMAGE_JPEG_QUALITY,
    );
  });
}

function closeBitmap(bitmap: ImageBitmap): void {
  if (typeof bitmap.close === "function") {
    bitmap.close();
  }
}
