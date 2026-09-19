import { describe, expect, it } from "vitest";

import {
  TitlesAIResponseSchema,
  TitlesRequestSchema,
  toTitleStyle,
} from "@/lib/ai/schemas/titles";
import { BRIEF_MAX, TITLE_COUNT } from "@/lib/rules/constants";

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
    hook?: string;
  };
};

// 与 lib/types 的 TitlesRequest 完全一致的合法请求
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
  };
}

function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const clone: Partial<T> = { ...source };
  delete clone[key];
  return clone as Omit<T, K>;
}

function titlesPayload(texts: string[]): unknown {
  return { titles: texts.map((text) => ({ text, style: "悬念" })) };
}

describe("TitlesRequestSchema —— /api/titles 请求校验", () => {
  it("合法请求（analysis + brief + topic）通过", () => {
    const result = TitlesRequestSchema.safeParse(validRequest());
    expect(result.success).toBe(true);
  });

  it("可选字段 hook 存在时保留", () => {
    const request = validRequest();
    request.topic = { ...request.topic, hook: "小时候的味道" };

    const result = TitlesRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topic.hook).toBe("小时候的味道");
    }
  });

  it("缺少 analysis / brief / topic 都不通过", () => {
    expect(TitlesRequestSchema.safeParse(omit(validRequest(), "analysis")).success).toBe(false);
    expect(TitlesRequestSchema.safeParse(omit(validRequest(), "brief")).success).toBe(false);
    expect(TitlesRequestSchema.safeParse(omit(validRequest(), "topic")).success).toBe(false);
  });

  it("topic 缺少必要字段不通过", () => {
    const request = validRequest();
    request.topic = omit(request.topic, "angle") as TestRequest["topic"];
    expect(TitlesRequestSchema.safeParse(request).success).toBe(false);
  });

  it("analysis 缺少必要字段不通过", () => {
    const request = validRequest();
    request.analysis = omit(request.analysis, "audience") as TestRequest["analysis"];
    expect(TitlesRequestSchema.safeParse(request).success).toBe(false);
  });

  it("brief 为空或超过 BRIEF_MAX 不通过，刚好等于上限通过", () => {
    const empty = { ...validRequest(), brief: "" };
    expect(TitlesRequestSchema.safeParse(empty).success).toBe(false);

    const tooLong = { ...validRequest(), brief: "字".repeat(BRIEF_MAX + 1) };
    expect(TitlesRequestSchema.safeParse(tooLong).success).toBe(false);

    const atLimit = { ...validRequest(), brief: "字".repeat(BRIEF_MAX) };
    expect(TitlesRequestSchema.safeParse(atLimit).success).toBe(true);
  });

  it("请求体不是对象不通过", () => {
    expect(TitlesRequestSchema.safeParse("文本").success).toBe(false);
    expect(TitlesRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe("TitlesAIResponseSchema —— 模型输出形状校验", () => {
  it("恰好 TITLE_COUNT 条候选标题通过", () => {
    const texts = Array.from({ length: TITLE_COUNT }, (_, index) => `候选标题${index}`);
    const result = TitlesAIResponseSchema.safeParse(titlesPayload(texts));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.titles).toHaveLength(TITLE_COUNT);
    }
  });

  it("数量不足或超出都不通过", () => {
    const fewer = Array.from({ length: TITLE_COUNT - 1 }, (_, index) => `候选${index}`);
    const more = Array.from({ length: TITLE_COUNT + 1 }, (_, index) => `候选${index}`);

    expect(TitlesAIResponseSchema.safeParse(titlesPayload(fewer)).success).toBe(false);
    expect(TitlesAIResponseSchema.safeParse(titlesPayload(more)).success).toBe(false);
    expect(TitlesAIResponseSchema.safeParse({ titles: [] }).success).toBe(false);
  });

  it("缺少 titles 或 titles 不是数组不通过", () => {
    expect(TitlesAIResponseSchema.safeParse({}).success).toBe(false);
    expect(TitlesAIResponseSchema.safeParse({ titles: "t1" }).success).toBe(false);
  });

  it("单条缺少 text 或 text 不是字符串不通过", () => {
    const texts = Array.from({ length: TITLE_COUNT }, (_, index) => `候选${index}`);
    const payload = titlesPayload(texts);

    expect(
      TitlesAIResponseSchema.safeParse({
        titles: [{ style: "悬念" }, ...(payload as { titles: unknown[] }).titles.slice(1)],
      }).success,
    ).toBe(false);

    expect(
      TitlesAIResponseSchema.safeParse({
        titles: [{ text: 1 }, ...(payload as { titles: unknown[] }).titles.slice(1)],
      }).success,
    ).toBe(false);
  });

  it("style 是可选字段，缺失也能通过", () => {
    const texts = Array.from({ length: TITLE_COUNT }, (_, index) => `候选${index}`);
    const result = TitlesAIResponseSchema.safeParse({
      titles: texts.map((text) => ({ text })),
    });

    expect(result.success).toBe(true);
  });

  it("超长标题不会被 schema 拦截（交给 validateTitle 判定）", () => {
    const texts = Array.from({ length: TITLE_COUNT }, () => "字".repeat(50));
    expect(TitlesAIResponseSchema.safeParse(titlesPayload(texts)).success).toBe(true);
  });
});

describe("toTitleStyle —— 风格收敛", () => {
  it("既定风格原样保留", () => {
    expect(toTitleStyle("悬念")).toBe("悬念");
    expect(toTitleStyle("清单")).toBe("清单");
  });

  it("未知风格与缺失值降级为 undefined", () => {
    expect(toTitleStyle("抒情")).toBeUndefined();
    expect(toTitleStyle("")).toBeUndefined();
    expect(toTitleStyle(undefined)).toBeUndefined();
  });
});
