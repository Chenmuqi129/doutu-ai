import { describe, expect, it } from "vitest";

import { DraftAIResponseSchema, DraftRequestSchema } from "@/lib/ai/schemas/draft";
import { BRIEF_MAX } from "@/lib/rules/constants";

type TestRequest = {
  analysis: {
    materialSummary: string;
    visualTags: string[];
    audience: string;
  };
  brief: string;
  topic: {
    id: string;
    title: string;
    description: string;
    angle: string;
  };
  selectedTitle: string;
};

// 与 lib/types 的 DraftRequest 完全一致的合法请求
function validRequest(): TestRequest {
  return {
    analysis: {
      materialSummary: "家庭制作的手工大米锅巴，包含成品特写与包装照片。",
      visualTags: ["手工食品", "锅巴", "乡村生活"],
      audience: "喜欢地方美食与手工食品的用户",
    },
    brief: "这是一份家庭手工锅巴素材，画面朴素，适合用真实生活的语气讲述。",
    topic: {
      id: "t1",
      title: "农村手工锅巴分享",
      description: "记录家里的手工锅巴",
      angle: "真实生活",
    },
    selectedTitle: "农村手工锅巴太香了",
  };
}

function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const clone: Partial<T> = { ...source };
  delete clone[key];
  return clone as Omit<T, K>;
}

describe("DraftRequestSchema —— /api/draft 请求校验", () => {
  it("合法请求（analysis + brief + topic + selectedTitle）通过", () => {
    expect(DraftRequestSchema.safeParse(validRequest()).success).toBe(true);
  });

  it("缺少 analysis / brief / topic / selectedTitle 都不通过", () => {
    expect(DraftRequestSchema.safeParse(omit(validRequest(), "analysis")).success).toBe(false);
    expect(DraftRequestSchema.safeParse(omit(validRequest(), "brief")).success).toBe(false);
    expect(DraftRequestSchema.safeParse(omit(validRequest(), "topic")).success).toBe(false);
    expect(DraftRequestSchema.safeParse(omit(validRequest(), "selectedTitle")).success).toBe(false);
  });

  it("selectedTitle 为空字符串不通过", () => {
    expect(DraftRequestSchema.safeParse({ ...validRequest(), selectedTitle: "" }).success).toBe(
      false,
    );
  });

  it("selectedTitle 超过 20 字在 schema 层放行（交给 validateTitle 判定）", () => {
    const request = { ...validRequest(), selectedTitle: "字".repeat(21) };
    expect(DraftRequestSchema.safeParse(request).success).toBe(true);
  });

  it("brief 超过 BRIEF_MAX 不通过", () => {
    const request = { ...validRequest(), brief: "字".repeat(BRIEF_MAX + 1) };
    expect(DraftRequestSchema.safeParse(request).success).toBe(false);
  });

  it("topic 缺少必要字段不通过", () => {
    const request = validRequest();
    request.topic = omit(request.topic, "angle") as TestRequest["topic"];
    expect(DraftRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("DraftAIResponseSchema —— 模型输出形状校验", () => {
  it("合法的 body + tags 通过", () => {
    const result = DraftAIResponseSchema.safeParse({
      body: "第一次吃到这种手工锅巴是在外婆家，米香很足。",
      tags: ["手工锅巴", "地方美食"],
    });

    expect(result.success).toBe(true);
  });

  it("缺少 body 或 body 为空不通过", () => {
    expect(DraftAIResponseSchema.safeParse({ tags: ["美食"] }).success).toBe(false);
    expect(DraftAIResponseSchema.safeParse({ body: "", tags: ["美食"] }).success).toBe(false);
  });

  it("body 不是字符串不通过", () => {
    expect(
      DraftAIResponseSchema.safeParse({ body: 123, tags: ["美食"] }).success,
    ).toBe(false);
  });

  it("缺少 tags、tags 不是数组或元素不是字符串都不通过", () => {
    expect(DraftAIResponseSchema.safeParse({ body: "正文内容" }).success).toBe(false);
    expect(DraftAIResponseSchema.safeParse({ body: "正文内容", tags: "美食" }).success).toBe(false);
    expect(DraftAIResponseSchema.safeParse({ body: "正文内容", tags: [1] }).success).toBe(false);
  });

  it("tags 为空数组不通过", () => {
    expect(DraftAIResponseSchema.safeParse({ body: "正文内容", tags: [] }).success).toBe(false);
  });

  it("正文过长 / 标签超过 5 个在 schema 层放行（交给规则层判定）", () => {
    const result = DraftAIResponseSchema.safeParse({
      body: "字".repeat(2000),
      tags: ["a", "b", "c", "d", "e", "f", "g"],
    });

    expect(result.success).toBe(true);
  });
});
