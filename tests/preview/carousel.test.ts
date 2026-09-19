import { describe, expect, it } from "vitest";

import {
  formatImageCounter,
  hasCarouselControls,
  normalizeImageIndex,
  stepImageIndex,
} from "@/lib/preview/carousel";

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
