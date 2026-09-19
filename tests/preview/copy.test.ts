import { describe, expect, it, vi } from "vitest";

import {
  COPY_FAILURE_MESSAGE,
  COPY_SUCCESS_MESSAGE,
  copyPreviewPart,
} from "@/lib/preview/copy";
import { PREVIEW_PARTS, type PublishContent } from "@/lib/rules/buildPreview";

const CONTENT: PublishContent = {
  title: "农村手工锅巴太香了",
  body: "第一段正文。\n\n第二段正文。",
  tags: ["#手工锅巴", "#地方美食", "#美食分享"],
};

function collector() {
  const written: string[] = [];
  return {
    written,
    write: async (text: string) => {
      written.push(text);
    },
  };
}

describe("copyPreviewPart —— 四个复制动作", () => {
  it("复制标题：只复制标题", async () => {
    const { written, write } = collector();

    const outcome = await copyPreviewPart(write, CONTENT, "title");

    expect(outcome.text).toBe("农村手工锅巴太香了");
    expect(written).toEqual(["农村手工锅巴太香了"]);
  });

  it("复制正文：只复制正文，保留段落换行", async () => {
    const { written, write } = collector();

    const outcome = await copyPreviewPart(write, CONTENT, "body");

    expect(outcome.text).toBe("第一段正文。\n\n第二段正文。");
    expect(written).toEqual(["第一段正文。\n\n第二段正文。"]);
  });

  it("复制标签：使用服务端校验后的最终标签", async () => {
    const { written, write } = collector();

    const outcome = await copyPreviewPart(write, CONTENT, "tags");

    expect(outcome.text).toBe("#手工锅巴 #地方美食 #美食分享");
    expect(written).toEqual(["#手工锅巴 #地方美食 #美食分享"]);
  });

  it("一键复制全部：标题 + 空行 + 正文 + 空行 + 标签", async () => {
    const { written, write } = collector();

    const outcome = await copyPreviewPart(write, CONTENT, "all");

    expect(outcome.text).toBe(
      "农村手工锅巴太香了\n\n第一段正文。\n\n第二段正文。\n\n#手工锅巴 #地方美食 #美食分享",
    );
    expect(written).toHaveLength(1);
  });

  it("一键复制全部不包含 validation / debug 等内部信息", async () => {
    const outcome = await copyPreviewPart(async () => {}, CONTENT, "all");

    expect(outcome.text).not.toContain("tagValidation");
    expect(outcome.text).not.toContain("removed");
    expect(outcome.text).not.toContain("{");
  });

  it("复制成功时返回「已复制」反馈", async () => {
    const outcome = await copyPreviewPart(async () => {}, CONTENT, "title");

    expect(outcome.ok).toBe(true);
    expect(outcome.message).toBe(COPY_SUCCESS_MESSAGE);
  });

  it("剪贴板失败时返回统一文案，且不泄露浏览器内部错误", async () => {
    const outcome = await copyPreviewPart(
      async () => {
        throw new Error("NotAllowedError: Document is not focused");
      },
      CONTENT,
      "title",
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe(COPY_FAILURE_MESSAGE);
    expect(outcome.message).not.toContain("NotAllowedError");
    expect(outcome.message).not.toContain("Document");
  });

  it("同步抛错与 Promise 拒绝都会走同一条失败路径", async () => {
    const outcome = await copyPreviewPart(
      () => {
        throw new Error("boom");
      },
      CONTENT,
      "tags",
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe(COPY_FAILURE_MESSAGE);
  });

  it("四个复制动作都不会触发任何 AI 网络请求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      for (const part of PREVIEW_PARTS) {
        const outcome = await copyPreviewPart(async () => {}, CONTENT, part);
        expect(outcome.ok).toBe(true);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
