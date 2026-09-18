import { describe, expect, it } from "vitest";

import {
  PREVIEW_PARTS,
  buildAllText,
  buildBodyText,
  buildPreview,
  buildTagsText,
  buildTitleText,
} from "@/lib/rules/buildPreview";

describe("buildPreview —— 复制文本构建", () => {
  it("只复制标题：去掉首尾空白", () => {
    expect(buildTitleText({ title: "  农村自制锅巴  " })).toBe("农村自制锅巴");
    expect(buildTitleText({})).toBe("");
    expect(buildTitleText({ title: "" })).toBe("");
  });

  it("只复制正文：保留段落换行，去掉首尾空白", () => {
    expect(buildBodyText({ body: "第一段\n\n第二段" })).toBe("第一段\n\n第二段");
    expect(buildBodyText({ body: "\n  第一段  \n" })).toBe("第一段");
    expect(buildBodyText({})).toBe("");
  });

  it("只复制标签：统一 #xxx 且用单空格分隔", () => {
    expect(buildTagsText({ tags: ["美食", "#锅巴", "  奶茶 "] })).toBe("#美食 #锅巴 #奶茶");
    expect(buildTagsText({ tags: [] })).toBe("");
    expect(buildTagsText({})).toBe("");
  });

  it("只复制标签：忽略空标签，不产生孤立的 #", () => {
    expect(buildTagsText({ tags: ["美食", "", "  ", "#"] })).toBe("#美食");
  });

  it("一键复制全部：标题 + 空行 + 正文 + 空行 + 标签", () => {
    const text = buildAllText({
      title: "农村自制锅巴",
      body: "第一段\n\n第二段",
      tags: ["美食", "#锅巴"],
    });
    expect(text).toBe("农村自制锅巴\n\n第一段\n\n第二段\n\n#美食 #锅巴");
  });

  it("一键复制全部：缺少某一部分时自动省略该段落", () => {
    expect(buildAllText({ title: "标题", body: "正文" })).toBe("标题\n\n正文");
    expect(buildAllText({ title: "标题", tags: ["美食"] })).toBe("标题\n\n#美食");
    expect(buildAllText({ body: "正文", tags: ["美食"] })).toBe("正文\n\n#美食");
    expect(buildAllText({ title: "标题" })).toBe("标题");
  });

  it("一键复制全部：空内容返回空字符串", () => {
    expect(buildAllText({})).toBe("");
    expect(buildAllText({ title: "  ", body: "\n", tags: [] })).toBe("");
  });

  it("统一入口 buildPreview 分发到四种输出", () => {
    const content = { title: "标题", body: "正文", tags: ["美食"] };
    expect(buildPreview(content, "title")).toBe(buildTitleText(content));
    expect(buildPreview(content, "body")).toBe(buildBodyText(content));
    expect(buildPreview(content, "tags")).toBe(buildTagsText(content));
    expect(buildPreview(content, "all")).toBe(buildAllText(content));
  });

  it("buildPreview 不传 part 时默认返回全部内容", () => {
    const content = { title: "标题", body: "正文", tags: ["美食"] };
    expect(buildPreview(content)).toBe("标题\n\n正文\n\n#美食");
  });

  it("PREVIEW_PARTS 覆盖四种复制目标", () => {
    expect([...PREVIEW_PARTS]).toEqual(["title", "body", "tags", "all"]);
  });

  it("纯函数：不修改传入的内容对象", () => {
    const tags = ["美食", "锅巴"];
    const content = { title: "标题", body: "正文", tags };
    buildAllText(content);
    expect(content).toEqual({ title: "标题", body: "正文", tags: ["美食", "锅巴"] });
    expect(tags).toEqual(["美食", "锅巴"]);
  });
});
