import { describe, expect, it } from "vitest";

import {
  formatImageCounter,
  hasCarouselControls,
  normalizeImageIndex,
  stepImageIndex,
  toAspectRatio,
} from "@/lib/preview/carousel";
import type { SessionImage } from "@/lib/types";

describe("ImageCarousel —— 索引与翻页逻辑", () => {
  describe("normalizeImageIndex", () => {
    it("正常范围原样返回", () => {
      expect(normalizeImageIndex(0, 5)).toBe(0);
      expect(normalizeImageIndex(3, 5)).toBe(3);
      expect(normalizeImageIndex(4, 5)).toBe(4);
    });

    it("越界时收敛到边界", () => {
      expect(normalizeImageIndex(-1, 5)).toBe(0);
      expect(normalizeImageIndex(9, 5)).toBe(4);
    });

    it("没有图片时固定为 0", () => {
      expect(normalizeImageIndex(3, 0)).toBe(0);
      expect(normalizeImageIndex(0, -1)).toBe(0);
    });
  });

  describe("stepImageIndex", () => {
    it("多图正常前后翻页", () => {
      expect(stepImageIndex(0, 1, 5)).toBe(1);
      expect(stepImageIndex(3, -1, 5)).toBe(2);
    });

    it("首尾循环：第一张往前到最后一张，最后一张往后回第一张", () => {
      expect(stepImageIndex(0, -1, 5)).toBe(4);
      expect(stepImageIndex(4, 1, 5)).toBe(0);
    });

    it("单图时永远停在 0", () => {
      expect(stepImageIndex(0, 1, 1)).toBe(0);
      expect(stepImageIndex(0, -1, 1)).toBe(0);
    });

    it("没有图片时固定为 0", () => {
      expect(stepImageIndex(0, 1, 0)).toBe(0);
    });
  });

  describe("formatImageCounter", () => {
    it("按「第 X 张 / 共 Y 张」展示", () => {
      expect(formatImageCounter(0, 5)).toBe("第 1 张 / 共 5 张");
      expect(formatImageCounter(4, 5)).toBe("第 5 张 / 共 5 张");
      expect(formatImageCounter(0, 1)).toBe("第 1 张 / 共 1 张");
    });

    it("越界索引也会收敛后再展示", () => {
      expect(formatImageCounter(99, 3)).toBe("第 3 张 / 共 3 张");
    });
  });

  describe("hasCarouselControls", () => {
    it("单图不显示 carousel 控件", () => {
      expect(hasCarouselControls(1)).toBe(false);
      expect(hasCarouselControls(0)).toBe(false);
    });

    it("多图显示 carousel 控件", () => {
      expect(hasCarouselControls(2)).toBe(true);
      expect(hasCarouselControls(9)).toBe(true);
    });
  });
});

describe("ImageCarousel —— 原图比例", () => {
  describe("toAspectRatio", () => {
    it("横图 1200×900 得到 4:3", () => {
      expect(toAspectRatio(1200, 900)).toBeCloseTo(4 / 3, 10);
    });

    it("竖图 900×1200 得到 3:4", () => {
      expect(toAspectRatio(900, 1200)).toBeCloseTo(3 / 4, 10);
    });

    it("方图 1080×1080 得到 1:1", () => {
      expect(toAspectRatio(1080, 1080)).toBe(1);
    });

    it("宽屏 1920×1080 得到 16:9", () => {
      expect(toAspectRatio(1920, 1080)).toBeCloseTo(16 / 9, 10);
    });

    it("3:4 不会再被当成 4:3（宽高顺序不能颠倒）", () => {
      expect(toAspectRatio(900, 1200)).not.toBeCloseTo(4 / 3, 4);
      expect(toAspectRatio(1200, 900)).not.toBeCloseTo(3 / 4, 4);
    });

    it("尺寸不合法时返回 undefined（调用方退化为按图片自身比例渲染）", () => {
      expect(toAspectRatio(0, 900)).toBeUndefined();
      expect(toAspectRatio(1200, 0)).toBeUndefined();
      expect(toAspectRatio(-1200, 900)).toBeUndefined();
      expect(toAspectRatio(Number.NaN, 900)).toBeUndefined();
      expect(toAspectRatio(1200, Number.POSITIVE_INFINITY)).toBeUndefined();
    });
  });

  it("多张不同尺寸的图片各自拥有自己的比例，互不影响", () => {
    const images: SessionImage[] = [
      makeImage("wide", 1920, 1080),
      makeImage("tall", 900, 1200),
      makeImage("square", 1080, 1080),
      makeImage("classic", 1200, 900),
    ];

    const ratios = images.map((image) => toAspectRatio(image.width, image.height));

    expect(ratios[0]).toBeCloseTo(16 / 9, 10);
    expect(ratios[1]).toBeCloseTo(3 / 4, 10);
    expect(ratios[2]).toBe(1);
    expect(ratios[3]).toBeCloseTo(4 / 3, 10);
  });

  it("切换图片（索引变化）会取到当前这张图的比例，而不是上一张的", () => {
    const images: SessionImage[] = [
      makeImage("wide", 1920, 1080),
      makeImage("tall", 900, 1200),
    ];

    const ratioOfCurrent = (index: number) => {
      const current = normalizeImageIndex(index, images.length);
      const image = images[current];
      return toAspectRatio(image.width, image.height);
    };

    expect(ratioOfCurrent(0)).toBeCloseTo(16 / 9, 10);
    expect(ratioOfCurrent(stepImageIndex(0, 1, images.length))).toBeCloseTo(3 / 4, 10);
  });

  it("图片顺序与上传顺序一致（比例也按同一顺序取值）", () => {
    const images: SessionImage[] = [
      makeImage("first", 1200, 900),
      makeImage("second", 900, 1200),
      makeImage("third", 1080, 1080),
    ];

    expect(images.map((image) => image.id)).toEqual(["first", "second", "third"]);
  });
});

function makeImage(id: string, width: number, height: number): SessionImage {
  return {
    id,
    objectUrl: `blob:mock-${id}`,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    width,
    height,
  };
}
