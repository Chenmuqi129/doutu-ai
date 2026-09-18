import { describe, expect, it } from "vitest";

import { AnalyzeResponseSchema } from "@/lib/ai/schemas/analyze";
import { BRIEF_MAX, TOPIC_COUNT } from "@/lib/rules/constants";

type TestTopic = {
  id: string;
  title: string;
  description: string;
  angle: string;
  hook?: string;
  reason?: string;
};

type TestPayload = {
  analysis: {
    materialSummary: string;
    visualTags: string[];
    audience: string;
  };
  topics: TestTopic[];
  brief: string;
};

// 去掉某个字段，用于构造「缺字段」的非法载荷
function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const clone: Partial<T> = { ...source };
  delete clone[key];
  return clone as Omit<T, K>;
}

// 与 lib/types/content.ts 的 MaterialAnalysisResult 完全一致的合法载荷
function validPayload(): TestPayload {
  return {
    analysis: {
      materialSummary: "家庭制作的手工大米锅巴，包含成品特写与包装照片。",
      visualTags: ["手工食品", "锅巴", "乡村生活"],
      audience: "喜欢地方美食与手工食品的用户",
    },
    topics: [
      {
        id: "t1",
        title: "农村手工锅巴分享",
        description: "记录家里的手工锅巴",
        angle: "真实生活",
      },
      {
        id: "t2",
        title: "15 元一斤的锅巴",
        description: "聊聊价格与用料",
        angle: "价格卖点",
      },
      {
        id: "t3",
        title: "家里怎么做锅巴",
        description: "展示制作过程",
        angle: "制作过程",
      },
    ],
    brief: "这是一份家庭手工锅巴素材，画面朴素，适合用真实生活的语气讲述。",
  };
}

describe("AnalyzeResponseSchema —— AI 输出结构校验", () => {
  it("合法的 AnalyzeResponse 通过校验", () => {
    const result = AnalyzeResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.analysis.materialSummary).toBe(
        "家庭制作的手工大米锅巴，包含成品特写与包装照片。",
      );
      expect(result.data.topics).toHaveLength(TOPIC_COUNT);
      expect(result.data.brief.length).toBeGreaterThan(0);
    }
  });

  it("可选字段 hook / reason 存在时保留", () => {
    const payload = validPayload();
    payload.topics[0] = { ...payload.topics[0], hook: "小时候的味道", reason: "容易引发共鸣" };

    const result = AnalyzeResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics[0].hook).toBe("小时候的味道");
    }
  });

  it("缺少 analysis 不通过", () => {
    expect(AnalyzeResponseSchema.safeParse(omit(validPayload(), "analysis")).success).toBe(
      false,
    );
  });

  it("缺少 topics 不通过", () => {
    expect(AnalyzeResponseSchema.safeParse(omit(validPayload(), "topics")).success).toBe(
      false,
    );
  });

  it("缺少 brief 不通过", () => {
    expect(AnalyzeResponseSchema.safeParse(omit(validPayload(), "brief")).success).toBe(
      false,
    );
  });

  describe("analysis 字段", () => {
    it("缺少 materialSummary / visualTags / audience 都不通过", () => {
      const base = validPayload();

      expect(
        AnalyzeResponseSchema.safeParse({
          ...base,
          analysis: omit(base.analysis, "materialSummary"),
        }).success,
      ).toBe(false);

      expect(
        AnalyzeResponseSchema.safeParse({
          ...base,
          analysis: omit(base.analysis, "visualTags"),
        }).success,
      ).toBe(false);

      expect(
        AnalyzeResponseSchema.safeParse({
          ...base,
          analysis: omit(base.analysis, "audience"),
        }).success,
      ).toBe(false);
    });

    it("visualTags 为空数组不通过", () => {
      const payload = validPayload();
      payload.analysis.visualTags = [];
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("materialSummary 为空字符串不通过", () => {
      const payload = validPayload();
      payload.analysis.materialSummary = "";
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("topic 字段", () => {
    it("topic 缺 description 不通过", () => {
      const payload = validPayload();
      payload.topics[0] = omit(payload.topics[0], "description") as TestTopic;
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("topic 缺 angle 不通过", () => {
      const payload = validPayload();
      payload.topics[0] = omit(payload.topics[0], "angle") as TestTopic;
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("topic 缺 id 或 title 不通过", () => {
      const payload = validPayload();
      payload.topics[0] = omit(payload.topics[0], "id") as TestTopic;
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("topics 数组", () => {
    it("只有 2 个选题不通过", () => {
      const payload = validPayload();
      payload.topics = payload.topics.slice(0, 2);
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("有 4 个选题不通过", () => {
      const payload = validPayload();
      payload.topics = [
        ...payload.topics,
        { id: "t4", title: "第四个", description: "多余的", angle: "多余" },
      ];
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("topic id 重复不通过", () => {
      const payload = validPayload();
      payload.topics[1] = { ...payload.topics[1], id: "t1" };
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("类型与长度", () => {
    it("analysis 不是对象不通过", () => {
      expect(
        AnalyzeResponseSchema.safeParse({ ...validPayload(), analysis: "文本" }).success,
      ).toBe(false);
    });

    it("topics 不是数组不通过", () => {
      expect(
        AnalyzeResponseSchema.safeParse({ ...validPayload(), topics: "t1" }).success,
      ).toBe(false);
    });

    it("visualTags 元素不是字符串不通过", () => {
      const payload = validPayload();
      payload.analysis.visualTags = [1 as unknown as string];
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("brief 超过上限不通过", () => {
      const payload = validPayload();
      payload.brief = "字".repeat(BRIEF_MAX + 1);
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(false);
    });

    it("brief 刚好等于上限通过", () => {
      const payload = validPayload();
      payload.brief = "字".repeat(BRIEF_MAX);
      expect(AnalyzeResponseSchema.safeParse(payload).success).toBe(true);
    });
  });
});
