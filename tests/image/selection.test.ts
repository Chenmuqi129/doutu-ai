import { beforeEach, describe, expect, it } from "vitest";

import { formatSelectedCount } from "@/lib/image/selection";
import { IMAGE_MAX } from "@/lib/rules/constants";
import { useSession } from "@/lib/store/useSession";
import type { SessionImage } from "@/lib/types";

function makeImage(id: string): SessionImage {
  return {
    id,
    objectUrl: `blob:mock-${id}`,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    width: 1200,
    height: 900,
  };
}

describe("formatSelectedCount —— 「已选 X / 9 张」文案", () => {
  it("0 张时返回 undefined（不显示计数）", () => {
    expect(formatSelectedCount(0, IMAGE_MAX)).toBeUndefined();
  });

  it("非法数量返回 undefined", () => {
    expect(formatSelectedCount(-1, IMAGE_MAX)).toBeUndefined();
    expect(formatSelectedCount(Number.NaN, IMAGE_MAX)).toBeUndefined();
    expect(formatSelectedCount(Number.POSITIVE_INFINITY, IMAGE_MAX)).toBeUndefined();
  });

  it("1 张显示「已选 1 / 9 张」", () => {
    expect(formatSelectedCount(1, IMAGE_MAX)).toBe("已选 1 / 9 张");
  });

  it("多张显示实际数量", () => {
    expect(formatSelectedCount(2, IMAGE_MAX)).toBe("已选 2 / 9 张");
    expect(formatSelectedCount(3, IMAGE_MAX)).toBe("已选 3 / 9 张");
    expect(formatSelectedCount(9, IMAGE_MAX)).toBe("已选 9 / 9 张");
  });

  it("文案明确表达「已选择图片数量」，不再是容易被误解为步骤的「1 / 9」", () => {
    const label = formatSelectedCount(1, IMAGE_MAX) ?? "";
    expect(label).toContain("已选");
    expect(label).toContain("张");
    expect(label).not.toBe("1 / 9");
  });
});

describe("上传数量文案与 store 里的真实图片数量一致", () => {
  beforeEach(() => {
    useSession.getState().resetSession();
  });

  it("上传 1 张显示「已选 1 / 9 张」", () => {
    useSession.getState().addImages([makeImage("only")]);

    expect(formatSelectedCount(useSession.getState().images.length, IMAGE_MAX)).toBe(
      "已选 1 / 9 张",
    );
  });

  it("上传 3 张显示「已选 3 / 9 张」", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b"), makeImage("c")]);

    expect(formatSelectedCount(useSession.getState().images.length, IMAGE_MAX)).toBe(
      "已选 3 / 9 张",
    );
  });

  it("上传 9 张显示「已选 9 / 9 张」", () => {
    useSession
      .getState()
      .addImages(Array.from({ length: IMAGE_MAX }, (_, index) => makeImage(`img-${index}`)));

    expect(formatSelectedCount(useSession.getState().images.length, IMAGE_MAX)).toBe(
      "已选 9 / 9 张",
    );
  });

  it("删除 1 张后数量随之更新为「已选 8 / 9 张」", () => {
    useSession
      .getState()
      .addImages(Array.from({ length: IMAGE_MAX }, (_, index) => makeImage(`img-${index}`)));

    useSession.getState().removeImage("img-0");

    expect(formatSelectedCount(useSession.getState().images.length, IMAGE_MAX)).toBe(
      "已选 8 / 9 张",
    );
  });

  it("清空图片后又回到不显示计数的状态", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b")]);

    useSession.getState().clearImages();

    expect(formatSelectedCount(useSession.getState().images.length, IMAGE_MAX)).toBeUndefined();
  });
});
