import { describe, expect, it } from "vitest";

import {
  countChars,
  isPunctuationOnly,
  normalizeTag,
  normalizeText,
  toDisplayTag,
  toHalfWidth,
} from "@/lib/rules/text";

describe("countChars —— 统一字符计数", () => {
  it("空输入与纯空白计 0", () => {
    expect(countChars("")).toBe(0);
    expect(countChars("   ")).toBe(0);
    expect(countChars("\n\n")).toBe(0);
    expect(countChars("\u3000")).toBe(0);
  });

  it("中文字符每个计 1", () => {
    expect(countChars("好")).toBe(1);
    expect(countChars("你好世界")).toBe(4);
    expect(countChars("农村自制锅巴真的太香了")).toBe(11);
  });

  it("英文字母每个计 1，大小写同等对待", () => {
    expect(countChars("abc")).toBe(3);
    expect(countChars("ABC")).toBe(3);
    expect(countChars("AbC")).toBe(3);
    expect(countChars("Hello")).toBe(5);
  });

  it("数字每个计 1", () => {
    expect(countChars("2026")).toBe(4);
    expect(countChars("12345")).toBe(5);
    expect(countChars("a1")).toBe(2);
  });

  it("中英文标点各计 1", () => {
    expect(countChars("。")).toBe(1);
    expect(countChars(".")).toBe(1);
    expect(countChars("！？")).toBe(2);
    expect(countChars("...")).toBe(3);
    expect(countChars("Hello, world!")).toBe(13);
  });

  it("emoji 按用户感知字符计 1（含组合序列）", () => {
    expect(countChars("😀")).toBe(1);
    expect(countChars("😀😀")).toBe(2);
    // 肤色修饰符与 ZWJ 组合序列整体算 1 个
    expect(countChars("👍🏻")).toBe(1);
    expect(countChars("👨‍👩‍👧")).toBe(1);
    // 区域指示符旗标（两个码点）算 1 个
    expect(countChars("🇨🇳")).toBe(1);
    expect(countChars("你好😀")).toBe(3);
  });

  it("全角与半角都各计 1，不做折算", () => {
    expect(countChars("ＡＩ")).toBe(2);
    expect(countChars("AI")).toBe(2);
    expect(countChars("１２３")).toBe(3);
    expect(countChars("123")).toBe(3);
    expect(countChars("Ａ")).toBe(countChars("A"));
  });

  it("首尾空白不计，内部空格与换行各计 1", () => {
    expect(countChars(" 你好 ")).toBe(2);
    expect(countChars("\u3000你好\u3000")).toBe(2);
    expect(countChars("你 好")).toBe(3);
    expect(countChars("第一行\n第二行")).toBe(7);
    expect(countChars("a\r\nb")).toBe(3);
  });

  it("不可见字符不计入", () => {
    expect(countChars("你\u200B好")).toBe(2);
    expect(countChars("a\u0000b")).toBe(2);
    expect(countChars("\uFEFF你好")).toBe(2);
  });

  it("计数结果与是否预先规范化无关（幂等）", () => {
    const raw = "  \u200B你好😀  ";
    expect(countChars(raw)).toBe(countChars(normalizeText(raw)));
    expect(countChars(normalizeText(raw))).toBe(3);
  });

  it("20 / 21 字边界按字符计", () => {
    expect(countChars("字".repeat(20))).toBe(20);
    expect(countChars("字".repeat(21))).toBe(21);
    expect(countChars("😀".repeat(20))).toBe(20);
    expect(countChars("a".repeat(21))).toBe(21);
  });
});

describe("toHalfWidth —— 全角转半角", () => {
  it("转换全角 ASCII 与全角空格", () => {
    expect(toHalfWidth("ＡＢＣ")).toBe("ABC");
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("！")).toBe("!");
    expect(toHalfWidth("：")).toBe(":");
    expect(toHalfWidth("＃")).toBe("#");
    expect(toHalfWidth("a\u3000b")).toBe("a b");
  });

  it("不转换中文标点与汉字", () => {
    expect(toHalfWidth("。")).toBe("。");
    expect(toHalfWidth("、")).toBe("、");
    expect(toHalfWidth("美食")).toBe("美食");
  });
});

describe("normalizeText —— 通用文本规范化", () => {
  it("去掉首尾空白（含全角空格）", () => {
    expect(normalizeText("  你好  ")).toBe("你好");
    expect(normalizeText("\u3000你好\u3000")).toBe("你好");
  });

  it("剔除不可见字符", () => {
    expect(normalizeText("a\u200Bb")).toBe("ab");
    expect(normalizeText("a\u0000b")).toBe("ab");
  });

  it("统一换行符", () => {
    expect(normalizeText("a\r\nb")).toBe("a\nb");
    expect(normalizeText("a\rb")).toBe("a\nb");
  });

  it("不折叠内部空格，不截断内容", () => {
    expect(normalizeText("你  好")).toBe("你  好");
    expect(normalizeText("  " + "字".repeat(30) + "  ")).toBe("字".repeat(30));
  });
});

describe("normalizeTag —— 标签规范化", () => {
  it("去掉各种形式的 # 前缀", () => {
    expect(normalizeTag("美食")).toBe("美食");
    expect(normalizeTag("#美食")).toBe("美食");
    expect(normalizeTag("＃美食")).toBe("美食");
    expect(normalizeTag("###美食")).toBe("美食");
    expect(normalizeTag("  # 美食  ")).toBe("美食");
  });

  it("去掉标签内部空白", () => {
    expect(normalizeTag("手工 锅巴")).toBe("手工锅巴");
    expect(normalizeTag("AI 工具")).toBe("AI工具");
  });

  it("去掉首尾标点", () => {
    expect(normalizeTag("美食，")).toBe("美食");
    expect(normalizeTag("（美食）")).toBe("美食");
    expect(normalizeTag("美食##")).toBe("美食");
    expect(normalizeTag("，美食。")).toBe("美食");
  });

  it("全角统一为半角", () => {
    expect(normalizeTag("ＡＩ")).toBe("AI");
    expect(normalizeTag("１２３")).toBe("123");
  });

  it("无效输入规范化为空字符串", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("！")).toBe("");
    expect(normalizeTag("，，")).toBe("");
  });
});

describe("toDisplayTag —— 统一 #xxx 输出", () => {
  it("补全 # 前缀", () => {
    expect(toDisplayTag("美食")).toBe("#美食");
    expect(toDisplayTag("#美食")).toBe("#美食");
    expect(toDisplayTag("＃美食")).toBe("#美食");
    expect(toDisplayTag("  美食  ")).toBe("#美食");
  });

  it("幂等：对已规范化的标签反复调用结果不变", () => {
    const once = toDisplayTag("美食");
    expect(toDisplayTag(once)).toBe(once);
  });

  it("规范化后为空时不产生孤立的 #", () => {
    expect(toDisplayTag("")).toBe("");
    expect(toDisplayTag("   ")).toBe("");
    expect(toDisplayTag("#")).toBe("");
  });
});

describe("isPunctuationOnly —— 纯标点判定", () => {
  it("空白与纯标点判为 true", () => {
    expect(isPunctuationOnly("")).toBe(true);
    expect(isPunctuationOnly("   ")).toBe(true);
    expect(isPunctuationOnly("。")).toBe(true);
    expect(isPunctuationOnly("！？")).toBe(true);
    expect(isPunctuationOnly("...")).toBe(true);
  });

  it("含有实际内容判为 false", () => {
    expect(isPunctuationOnly("你好")).toBe(false);
    expect(isPunctuationOnly("你好。")).toBe(false);
    expect(isPunctuationOnly("123")).toBe(false);
    expect(isPunctuationOnly("a")).toBe(false);
    expect(isPunctuationOnly("😀")).toBe(false);
  });
});
