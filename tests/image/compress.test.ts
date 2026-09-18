import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES, isAppError } from "@/lib/errors";
import { compressImage, computeTargetSize } from "@/lib/image/compress";
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
} from "@/lib/rules/constants";

/* ---------------- canvas / bitmap 桩 ---------------- */

const paintCalls: { fillStyle?: string; fillRect: number[][]; drawImage: number[][] } = {
  fillRect: [],
  drawImage: [],
};

let convertToBlobOptions: { type?: string; quality?: number } | undefined;
let nextBlob: Blob = new Blob([new Uint8Array(1024)], { type: "image/jpeg" });
let bitmapSize = { width: 4000, height: 3000 };
let bitmapCloseCount = 0;
let createBitmapShouldFail = false;

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}

  getContext(kind: string) {
    if (kind !== "2d") {
      return null;
    }
    return {
      set fillStyle(value: string) {
        paintCalls.fillStyle = value;
      },
      fillRect: (x: number, y: number, w: number, h: number) => {
        paintCalls.fillRect.push([x, y, w, h]);
      },
      drawImage: (_image: unknown, x: number, y: number, w: number, h: number) => {
        paintCalls.drawImage.push([x, y, w, h]);
      },
    };
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    convertToBlobOptions = options;
    return nextBlob;
  }
}

function jpegFile(name = "photo.jpg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

beforeEach(() => {
  paintCalls.fillStyle = undefined;
  paintCalls.fillRect = [];
  paintCalls.drawImage = [];
  convertToBlobOptions = undefined;
  nextBlob = new Blob([new Uint8Array(1024)], { type: "image/jpeg" });
  bitmapSize = { width: 4000, height: 3000 };
  bitmapCloseCount = 0;
  createBitmapShouldFail = false;

  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  vi.stubGlobal("createImageBitmap", async () => {
    if (createBitmapShouldFail) {
      throw new Error("decode failed");
    }
    return {
      width: bitmapSize.width,
      height: bitmapSize.height,
      close: () => {
        bitmapCloseCount += 1;
      },
    };
  });
});

/* ---------------- computeTargetSize ---------------- */

describe("computeTargetSize —— 尺寸缩放", () => {
  it("超大横图按长边缩放到 IMAGE_MAX_EDGE", () => {
    const target = computeTargetSize(4000, 3000);

    expect(target.width).toBe(IMAGE_MAX_EDGE);
    expect(target.height).toBe(1176);
    expect(target.scale).toBeLessThan(1);
  });

  it("超大竖图同样按长边缩放", () => {
    const target = computeTargetSize(3000, 4000);

    expect(target.height).toBe(IMAGE_MAX_EDGE);
    expect(target.width).toBe(1176);
  });

  it("正方形超大图缩放后仍是正方形", () => {
    const target = computeTargetSize(2000, 2000);

    expect(target.width).toBe(IMAGE_MAX_EDGE);
    expect(target.height).toBe(IMAGE_MAX_EDGE);
  });

  it("小图不放大", () => {
    const target = computeTargetSize(1000, 800);

    expect(target.width).toBe(1000);
    expect(target.height).toBe(800);
    expect(target.scale).toBe(1);
  });

  it("恰好等于上限时不缩放", () => {
    const target = computeTargetSize(IMAGE_MAX_EDGE, 800);

    expect(target.width).toBe(IMAGE_MAX_EDGE);
    expect(target.scale).toBe(1);
  });

  it("极端长图缩放后仍有最小 1px 边长", () => {
    const target = computeTargetSize(100000, 1);

    expect(target.width).toBe(IMAGE_MAX_EDGE);
    expect(target.height).toBe(1);
  });

  it("非法尺寸抛 INVALID_INPUT", () => {
    for (const [width, height] of [
      [0, 100],
      [100, 0],
      [-1, 100],
      [Number.NaN, 100],
    ]) {
      try {
        computeTargetSize(width, height);
        throw new Error("expected to throw");
      } catch (error) {
        expect(isAppError(error) && error.code === ERROR_CODES.INVALID_INPUT).toBe(true);
      }
    }
  });
});

/* ---------------- compressImage ---------------- */

describe("compressImage —— 客户端压缩", () => {
  it("正常图片：输出 JPEG，并返回缩放后的尺寸", async () => {
    bitmapSize = { width: 800, height: 600 };

    const result = await compressImage(jpegFile());

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.sizeBytes).toBe(1024);
    expect(convertToBlobOptions?.type).toBe("image/jpeg");
    expect(convertToBlobOptions?.quality).toBe(IMAGE_JPEG_QUALITY);
  });

  it("超大图片：按长边缩放到 IMAGE_MAX_EDGE", async () => {
    bitmapSize = { width: 4000, height: 3000 };

    const result = await compressImage(jpegFile());

    expect(result.width).toBe(IMAGE_MAX_EDGE);
    expect(result.height).toBe(1176);
    expect(paintCalls.drawImage).toEqual([[0, 0, IMAGE_MAX_EDGE, 1176]]);
  });

  it("绘制前先铺白底，避免 PNG 透明区域变黑", async () => {
    bitmapSize = { width: 1000, height: 1000 };

    await compressImage(jpegFile());

    expect(paintCalls.fillStyle).toBe("#ffffff");
    expect(paintCalls.fillRect).toEqual([[0, 0, 1000, 1000]]);
  });

  it("压缩后仍然超过 IMAGE_MAX_BYTES 时抛 IMAGE_TOO_LARGE", async () => {
    nextBlob = { size: IMAGE_MAX_BYTES + 1, type: "image/jpeg" } as Blob;

    await expect(compressImage(jpegFile())).rejects.toMatchObject({
      code: ERROR_CODES.IMAGE_TOO_LARGE,
    });
  });

  it("压缩后刚好等于上限时通过", async () => {
    nextBlob = { size: IMAGE_MAX_BYTES, type: "image/jpeg" } as Blob;

    const result = await compressImage(jpegFile());

    expect(result.sizeBytes).toBe(IMAGE_MAX_BYTES);
  });

  it("不支持的 MIME 直接抛 UNSUPPORTED_IMAGE_TYPE", async () => {
    const file = new File([new Uint8Array(10)], "note.txt", { type: "text/plain" });

    await expect(compressImage(file)).rejects.toMatchObject({
      code: ERROR_CODES.UNSUPPORTED_IMAGE_TYPE,
    });
  });

  it("空文件抛 INVALID_INPUT", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });

    await expect(compressImage(file)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
    });
  });

  it("图片解码失败时抛 INVALID_INPUT", async () => {
    createBitmapShouldFail = true;

    await expect(compressImage(jpegFile())).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
    });
  });

  it("处理结束后释放 ImageBitmap", async () => {
    await compressImage(jpegFile());

    expect(bitmapCloseCount).toBe(1);
  });

  it("即使压缩失败也会释放 ImageBitmap", async () => {
    nextBlob = { size: IMAGE_MAX_BYTES + 1, type: "image/jpeg" } as Blob;

    await expect(compressImage(jpegFile())).rejects.toMatchObject({
      code: ERROR_CODES.IMAGE_TOO_LARGE,
    });
    expect(bitmapCloseCount).toBe(1);
  });
});
