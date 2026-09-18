import { describe, expect, it } from "vitest";

import { TAG_MAX } from "@/lib/rules/constants";
import { validateTags } from "@/lib/rules/validateTags";

describe("validateTags —— 标签规范化与校验", () => {
  it("规格书 §11 示例：#美食、#美食、美食、#锅巴 → #美食、#锅巴", () => {
    const result = validateTags(["#美食", "#美食", "美食", "#锅巴"]);
    expect(result.tags).toEqual(["#美食", "#锅巴"]);
    // 「#美食」与「美食」都被判定为与首个标签重复，因此各记录一次
    expect(result.duplicates).toEqual(["#美食", "#美食"]);
    expect(result.removedCount).toBe(0);
    expect(result.dropped).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it("max 取自 constants.ts 的 TAG_MAX", () => {
    expect(validateTags(["美食"]).max).toBe(TAG_MAX);
  });

  describe("# 前缀规范化", () => {
    it("无 # 时自动补上", () => {
      expect(validateTags(["美食"]).tags).toEqual(["#美食"]);
    });

    it("已有 # 时保持不变", () => {
      expect(validateTags(["#美食"]).tags).toEqual(["#美食"]);
    });

    it("全角 # 与重复 # 都会被规范化", () => {
      expect(validateTags(["＃美食"]).tags).toEqual(["#美食"]);
      expect(validateTags(["##美食"]).tags).toEqual(["#美食"]);
      expect(validateTags(["# 美食"]).tags).toEqual(["#美食"]);
    });
  });

  describe("去重", () => {
    it("完全相同的标签去重", () => {
      const result = validateTags(["美食", "美食"]);
      expect(result.tags).toEqual(["#美食"]);
      expect(result.duplicates).toEqual(["#美食"]);
    });

    it("带 # 与不带 # 视为同一个标签", () => {
      expect(validateTags(["#美食", "美食"]).tags).toEqual(["#美食"]);
    });

    it("大小写不同视为同一个标签，保留首次出现的写法", () => {
      const result = validateTags(["AI", "ai", "Ai"]);
      expect(result.tags).toEqual(["#AI"]);
      expect(result.duplicates).toEqual(["#ai", "#Ai"]);
    });

    it("全角与半角视为同一个标签", () => {
      const result = validateTags(["ＡＩ", "AI"]);
      expect(result.tags).toEqual(["#AI"]);
      expect(result.duplicates).toEqual(["#AI"]);
    });
  });

  describe("空白与无效标签", () => {
    it("前后空格被去掉", () => {
      expect(validateTags(["  美食  "]).tags).toEqual(["#美食"]);
    });

    it("标签内部空格被去掉", () => {
      expect(validateTags(["手工 锅巴"]).tags).toEqual(["#手工锅巴"]);
    });

    it("空字符串与纯空白被忽略，不算无效标签", () => {
      const result = validateTags(["", "   ", "\u3000"]);
      expect(result.tags).toEqual([]);
      expect(result.dropped).toEqual([]);
      expect(result.changed).toBe(false);
    });

    it("规范化后为空（如 # 或 ！）算无效标签", () => {
      const result = validateTags(["#", "！", "美食"]);
      expect(result.tags).toEqual(["#美食"]);
      expect(result.dropped).toEqual(["#", "！"]);
      expect(result.changed).toBe(true);
    });

    it("超过单标签长度上限的标签被丢弃", () => {
      const longTag = "字".repeat(21);
      const result = validateTags([longTag, "美食"]);
      expect(result.tags).toEqual(["#美食"]);
      expect(result.dropped).toEqual([longTag]);
    });

    it("刚好 20 字的标签保留", () => {
      const tag = "字".repeat(20);
      expect(validateTags([tag]).tags).toEqual([`#${tag}`]);
    });
  });

  describe("数量上限与移除数量", () => {
    it("5 个标签：全部保留，无移除", () => {
      const result = validateTags(["a", "b", "c", "d", "e"]);
      expect(result.tags).toEqual(["#a", "#b", "#c", "#d", "#e"]);
      expect(result.removed).toEqual([]);
      expect(result.removedCount).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it("6 个标签：保留 5 个，移除 1 个", () => {
      const result = validateTags(["a", "b", "c", "d", "e", "f"]);
      expect(result.tags).toHaveLength(5);
      expect(result.tags).toEqual(["#a", "#b", "#c", "#d", "#e"]);
      expect(result.removed).toEqual(["#f"]);
      expect(result.removedCount).toBe(1);
      expect(result.message).toBe("已自动保留 5 个标签，移除 1 个。");
    });

    it("7 个标签：保留 5 个，移除 2 个", () => {
      const result = validateTags(["a", "b", "c", "d", "e", "f", "g"]);
      expect(result.tags).toHaveLength(TAG_MAX);
      expect(result.removed).toEqual(["#f", "#g"]);
      expect(result.removedCount).toBe(2);
      expect(result.message).toBe("已自动保留 5 个标签，移除 2 个。");
    });

    it("先去重再截断：重复项不占用名额", () => {
      const result = validateTags(["a", "a", "b", "c", "d", "e", "f"]);
      expect(result.tags).toEqual(["#a", "#b", "#c", "#d", "#e"]);
      expect(result.duplicates).toEqual(["#a"]);
      expect(result.removed).toEqual(["#f"]);
      expect(result.removedCount).toBe(1);
    });

    it("无效标签不占用名额", () => {
      const result = validateTags(["a", "#", "b", "c", "d", "e", "f"]);
      expect(result.tags).toEqual(["#a", "#b", "#c", "#d", "#e"]);
      expect(result.dropped).toEqual(["#"]);
      expect(result.removedCount).toBe(1);
    });
  });

  describe("顺序与幂等", () => {
    it("保持输入的原始顺序", () => {
      expect(validateTags(["丙", "甲", "乙"]).tags).toEqual(["#丙", "#甲", "#乙"]);
    });

    it("混合噪声输入后顺序仍然稳定", () => {
      const result = validateTags(["  丙 ", "#丙", "甲", "！", "乙"]);
      expect(result.tags).toEqual(["#丙", "#甲", "#乙"]);
      expect(result.duplicates).toEqual(["#丙"]);
      expect(result.dropped).toEqual(["！"]);
    });

    it("幂等：把结果再喂回去不会继续变化", () => {
      const first = validateTags(["#美食", "美食", "锅巴"]);
      const second = validateTags(first.tags);
      expect(second.tags).toEqual(first.tags);
      expect(second.changed).toBe(false);
      expect(second.removedCount).toBe(0);
    });

    it("不修改传入的数组", () => {
      const input = ["#美食", "美食"];
      validateTags(input);
      expect(input).toEqual(["#美食", "美食"]);
    });

    it("空数组返回空结果", () => {
      const result = validateTags([]);
      expect(result.tags).toEqual([]);
      expect(result.removedCount).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.message).toBeUndefined();
    });
  });
});
