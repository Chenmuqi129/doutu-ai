import { describe, expect, it } from "vitest";

import { TITLE_MAX } from "@/lib/rules/constants";
import { validateTitle } from "@/lib/rules/validateTitle";

describe("validateTitle —— 标题校验", () => {
  it("返回结构固定为 valid / count / max / normalized（reason 仅失败时出现）", () => {
    const passed = validateTitle("标题");
    expect(Object.keys(passed).sort()).toEqual(["count", "max", "normalized", "valid"]);
    expect(passed.valid).toBe(true);

    const failed = validateTitle("");
    expect(Object.keys(failed).sort()).toEqual(["count", "max", "normalized", "reason", "valid"]);
    expect(failed.valid).toBe(false);
  });

  it("max 取自 constants.ts 的 TITLE_MAX", () => {
    expect(validateTitle("标题").max).toBe(TITLE_MAX);
    expect(validateTitle("字".repeat(30)).max).toBe(TITLE_MAX);
  });

  describe("字符数边界 19 / 20 / 21", () => {
    it("19 字通过", () => {
      const result = validateTitle("字".repeat(19));
      expect(result.valid).toBe(true);
      expect(result.count).toBe(19);
      expect(result.reason).toBeUndefined();
    });

    it("20 字通过", () => {
      const result = validateTitle("字".repeat(20));
      expect(result.valid).toBe(true);
      expect(result.count).toBe(20);
      expect(result.reason).toBeUndefined();
    });

    it("21 字不通过，且不会自动截断", () => {
      const raw = "字".repeat(21);
      const result = validateTitle(raw);
      expect(result.valid).toBe(false);
      expect(result.count).toBe(21);
      expect(result.max).toBe(20);
      expect(result.reason).toBe("TITLE_TOO_LONG");
      expect(result.normalized).toBe(raw);
      expect(result.normalized).toHaveLength(21);
    });

    it("远超上限时 normalized 仍然完整保留", () => {
      const raw = "字".repeat(50);
      const result = validateTitle(raw);
      expect(result.valid).toBe(false);
      expect(result.count).toBe(50);
      expect(result.normalized).toBe(raw);
    });
  });

  describe("各类字符的计数", () => {
    it("中文 20 字通过", () => {
      expect(validateTitle("农村自制锅巴真的太香了哈哈").valid).toBe(true);
      expect(validateTitle("农村自制锅巴真的太香了哈哈").count).toBe(13);
      expect(validateTitle("字".repeat(20)).count).toBe(20);
    });

    it("英文 20 / 21 字边界", () => {
      expect(validateTitle("a".repeat(20)).valid).toBe(true);
      expect(validateTitle("a".repeat(21)).valid).toBe(false);
      expect(validateTitle("Hello world").count).toBe(11);
    });

    it("数字按字符计", () => {
      expect(validateTitle("12345678901234567890").valid).toBe(true);
      expect(validateTitle("12345678901234567890").count).toBe(20);
      expect(validateTitle("123456789012345678901").valid).toBe(false);
    });

    it("含标点时标点各计 1", () => {
      const result = validateTitle("好".repeat(19) + "！");
      expect(result.count).toBe(20);
      expect(result.valid).toBe(true);

      expect(validateTitle("好".repeat(19) + "！！").count).toBe(21);
      expect(validateTitle("好".repeat(19) + "！！").valid).toBe(false);
    });

    it("emoji 按用户感知字符计 1", () => {
      expect(validateTitle("😀".repeat(20)).count).toBe(20);
      expect(validateTitle("😀".repeat(20)).valid).toBe(true);
      expect(validateTitle("😀".repeat(21)).count).toBe(21);
      expect(validateTitle("😀".repeat(21)).valid).toBe(false);
      expect(validateTitle("你好👍🏻").count).toBe(3);
    });

    it("全角与半角都各计 1", () => {
      expect(validateTitle("Ａ".repeat(20)).count).toBe(20);
      expect(validateTitle("Ａ".repeat(20)).valid).toBe(true);
      expect(validateTitle("Ａ".repeat(21)).valid).toBe(false);
    });
  });

  describe("空标题与首尾空白", () => {
    it("0 字不通过，原因为 TITLE_EMPTY", () => {
      const result = validateTitle("");
      expect(result.valid).toBe(false);
      expect(result.count).toBe(0);
      expect(result.reason).toBe("TITLE_EMPTY");
      expect(result.normalized).toBe("");
    });

    it("纯空白不通过", () => {
      expect(validateTitle("   ").valid).toBe(false);
      expect(validateTitle("   ").reason).toBe("TITLE_EMPTY");
      expect(validateTitle("\u3000").count).toBe(0);
    });

    it("纯标点不通过", () => {
      const result = validateTitle("。");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("TITLE_EMPTY");
      expect(validateTitle("！？").valid).toBe(false);
    });

    it("1 个字通过", () => {
      const result = validateTitle("好");
      expect(result.valid).toBe(true);
      expect(result.count).toBe(1);
    });

    it("首尾空白被去掉，且不计入字数", () => {
      const result = validateTitle("  标题  ");
      expect(result.normalized).toBe("标题");
      expect(result.count).toBe(2);
      expect(result.valid).toBe(true);
    });

    it("不可见字符不计入字数", () => {
      const result = validateTitle("\u200B标题\u200B");
      expect(result.normalized).toBe("标题");
      expect(result.count).toBe(2);
    });

    it("去掉首尾空白后刚好 21 字仍然不通过", () => {
      const result = validateTitle("  " + "字".repeat(21) + "  ");
      expect(result.count).toBe(21);
      expect(result.valid).toBe(false);
      expect(result.normalized).toHaveLength(21);
    });
  });
});
