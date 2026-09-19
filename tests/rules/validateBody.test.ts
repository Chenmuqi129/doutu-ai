import { describe, expect, it } from "vitest";

import { BODY_MAX, BODY_MIN } from "@/lib/rules/constants";
import { validateBody } from "@/lib/rules/validateBody";

const NORMAL_BODY = "第一次吃到这种手工锅巴是在外婆家，米香很足，咬下去脆而不硬。";

describe("validateBody —— 正文校验", () => {
  it("返回结构固定为 valid / count / min / max / normalized（reason 仅失败时出现）", () => {
    const passed = validateBody(NORMAL_BODY);
    expect(Object.keys(passed).sort()).toEqual(["count", "max", "min", "normalized", "valid"]);
    expect(passed.valid).toBe(true);

    const failed = validateBody("");
    expect(Object.keys(failed).sort()).toEqual([
      "count",
      "max",
      "min",
      "normalized",
      "reason",
      "valid",
    ]);
    expect(failed.valid).toBe(false);
  });

  it("min / max 取自 constants.ts 的 BODY_MIN / BODY_MAX", () => {
    expect(validateBody(NORMAL_BODY).min).toBe(BODY_MIN);
    expect(validateBody(NORMAL_BODY).max).toBe(BODY_MAX);
    expect(validateBody("字".repeat(BODY_MAX + 1)).max).toBe(BODY_MAX);
  });

  describe("长度边界", () => {
    it(`${BODY_MIN - 1} 字不通过，原因为 BODY_TOO_SHORT`, () => {
      const result = validateBody("字".repeat(BODY_MIN - 1));
      expect(result.valid).toBe(false);
      expect(result.count).toBe(BODY_MIN - 1);
      expect(result.reason).toBe("BODY_TOO_SHORT");
    });

    it(`${BODY_MIN} 字通过`, () => {
      const result = validateBody("字".repeat(BODY_MIN));
      expect(result.valid).toBe(true);
      expect(result.count).toBe(BODY_MIN);
      expect(result.reason).toBeUndefined();
    });

    it(`${BODY_MAX} 字通过`, () => {
      const result = validateBody("字".repeat(BODY_MAX));
      expect(result.valid).toBe(true);
      expect(result.count).toBe(BODY_MAX);
    });

    it(`${BODY_MAX + 1} 字不通过，且不截断`, () => {
      const raw = "字".repeat(BODY_MAX + 1);
      const result = validateBody(raw);
      expect(result.valid).toBe(false);
      expect(result.count).toBe(BODY_MAX + 1);
      expect(result.reason).toBe("BODY_TOO_LONG");
      expect(result.normalized).toBe(raw);
      expect(result.normalized).toHaveLength(BODY_MAX + 1);
    });
  });

  describe("空内容", () => {
    it("空字符串、纯空白、纯标点都判为 BODY_EMPTY", () => {
      expect(validateBody("").reason).toBe("BODY_EMPTY");
      expect(validateBody("   \n\n  ").reason).toBe("BODY_EMPTY");
      expect(validateBody("。".repeat(BODY_MIN)).reason).toBe("BODY_EMPTY");
      expect(validateBody("").count).toBe(0);
    });
  });

  describe("文本规范化", () => {
    it("首尾空白不计入，normalized 去掉首尾空白", () => {
      const result = validateBody(`  ${NORMAL_BODY}  `);
      expect(result.normalized).toBe(NORMAL_BODY);
      expect(result.count).toBe(NORMAL_BODY.length);
    });

    it("不可见字符被剔除", () => {
      const result = validateBody(`\u200B${NORMAL_BODY}\u200B`);
      expect(result.normalized).toBe(NORMAL_BODY);
    });

    it("保留段落换行，只统一换行符", () => {
      const body = `第一段正文，用来凑够长度测试换行。\r\n\r\n第二段正文，同样需要足够的字符。`;
      const result = validateBody(body);
      expect(result.normalized).toContain("\n\n");
      expect(result.normalized).not.toContain("\r");
    });

    it("emoji 按用户感知字符计 1", () => {
      expect(validateBody("😀".repeat(BODY_MIN)).count).toBe(BODY_MIN);
      expect(validateBody("😀".repeat(BODY_MIN)).valid).toBe(true);
    });
  });
});
