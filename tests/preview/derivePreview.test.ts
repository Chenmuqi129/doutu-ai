import { beforeEach, describe, expect, it } from "vitest";

import { TITLE_MAX } from "@/lib/rules/constants";
import { derivePreviewContent } from "@/lib/preview/derivePreview";
import { useSession } from "@/lib/store/useSession";
import type {
  ContentDraft,
  GeneratedTitle,
  MaterialAnalysisResult,
  SessionImage,
} from "@/lib/types";

const ANALYSIS_RESULT: MaterialAnalysisResult = {
  analysis: {
    materialSummary: "家庭手工锅巴素材",
    visualTags: ["手工食品", "锅巴"],
    audience: "喜欢地方美食的用户",
  },
  topics: [
    { id: "t1", title: "农村手工锅巴分享", description: "记录生活", angle: "真实生活" },
    { id: "t2", title: "15 元一斤的锅巴", description: "聊聊价格", angle: "价格卖点" },
    { id: "t3", title: "家里怎么做锅巴", description: "展示过程", angle: "制作过程" },
  ],
  brief: "一段用于后续步骤的紧凑 Brief。",
};

const TITLE_A: GeneratedTitle = {
  text: "农村手工锅巴太香了",
  count: 9,
  max: TITLE_MAX,
  valid: true,
  normalized: "农村手工锅巴太香了",
};

const TITLE_B: GeneratedTitle = {
  text: "家里怎么做手工锅巴",
  count: 9,
  max: TITLE_MAX,
  valid: true,
  normalized: "家里怎么做手工锅巴",
};

const DRAFT_A: ContentDraft = {
  body: "第一段正文。\n\n第二段正文。",
  tags: ["#手工锅巴", "#地方美食"],
};

const DRAFT_B: ContentDraft = {
  body: "重新生成之后的正文内容，用于验证预览会跟随更新。",
  tags: ["#美食分享"],
};

function makeImage(id: string): SessionImage {
  return {
    id,
    objectUrl: `blob:mock-${id}`,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    width: 1280,
    height: 960,
  };
}

beforeEach(() => {
  useSession.getState().resetSession();
  localStorage.clear();
});

// 走真实动作链，验证「预览完全由当前 store 数据派生」
function withFullContent(): void {
  const state = useSession.getState();
  state.addImages([makeImage("a"), makeImage("b"), makeImage("c")]);
  state.applyAnalysis(ANALYSIS_RESULT);
  state.selectTopic("t1");
  state.applyTitles([TITLE_A, TITLE_B]);
  state.selectTitle(TITLE_A.text);
  state.applyDraft(DRAFT_A);
}

describe("derivePreviewContent —— 显示条件", () => {
  it("没有图片时不显示预览", () => {
    const state = useSession.getState();
    state.applyAnalysis(ANALYSIS_RESULT);
    state.selectTopic("t1");
    state.applyTitles([TITLE_A]);
    state.selectTitle(TITLE_A.text);
    state.applyDraft(DRAFT_A);

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });

  it("没有选定标题时不显示预览", () => {
    const state = useSession.getState();
    state.addImages([makeImage("a")]);
    state.applyAnalysis(ANALYSIS_RESULT);
    state.selectTopic("t1");
    state.applyTitles([TITLE_A]);
    state.applyDraft(DRAFT_A);

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });

  it("没有 draft 时不显示预览", () => {
    const state = useSession.getState();
    state.addImages([makeImage("a")]);
    state.applyAnalysis(ANALYSIS_RESULT);
    state.selectTopic("t1");
    state.applyTitles([TITLE_A]);
    state.selectTitle(TITLE_A.text);

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });

  it("正文为空时不显示预览", () => {
    withFullContent();
    useSession.getState().applyDraft({ body: "", tags: ["#美食"] });

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });

  it("数据齐全时返回标题 / 正文 / 标签", () => {
    withFullContent();

    expect(derivePreviewContent(useSession.getState())).toEqual({
      title: TITLE_A.text,
      body: DRAFT_A.body,
      tags: DRAFT_A.tags,
    });
  });

  it("单图同样可以进入预览", () => {
    const state = useSession.getState();
    state.addImages([makeImage("only")]);
    state.applyAnalysis(ANALYSIS_RESULT);
    state.selectTopic("t1");
    state.applyTitles([TITLE_A]);
    state.selectTitle(TITLE_A.text);
    state.applyDraft(DRAFT_A);

    expect(derivePreviewContent(useSession.getState())?.title).toBe(TITLE_A.text);
  });

  it("标题与正文的首尾空白会被规范化", () => {
    withFullContent();

    const preview = derivePreviewContent({
      images: useSession.getState().images,
      selectedTitle: `  ${TITLE_A.text}  `,
      draft: { body: `\n ${DRAFT_A.body} \n`, tags: DRAFT_A.tags },
    });

    expect(preview?.title).toBe(TITLE_A.text);
    expect(preview?.body).toBe(DRAFT_A.body);
  });
});

describe("derivePreviewContent —— 与 store 保持一致", () => {
  it("图片顺序与上传顺序一致", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b"), makeImage("c")]);

    expect(useSession.getState().images.map((image) => image.id)).toEqual(["a", "b", "c"]);
  });

  it("标签使用服务端 validateTags 之后的最终结果", () => {
    withFullContent();

    expect(derivePreviewContent(useSession.getState())?.tags).toEqual([
      "#手工锅巴",
      "#地方美食",
    ]);
  });

  it("更换标题后预览跟随新标题（旧 draft 作废 → 重新生成后更新）", () => {
    withFullContent();
    expect(derivePreviewContent(useSession.getState())?.title).toBe(TITLE_A.text);

    useSession.getState().selectTitle(TITLE_B.text);
    expect(derivePreviewContent(useSession.getState())).toBeUndefined();

    useSession.getState().applyDraft(DRAFT_B);
    const preview = derivePreviewContent(useSession.getState());

    expect(preview?.title).toBe(TITLE_B.text);
    expect(preview?.body).toBe(DRAFT_B.body);
  });

  it("重新生成 draft 后预览跟随新正文", () => {
    withFullContent();

    useSession.getState().applyDraft(DRAFT_B);
    const preview = derivePreviewContent(useSession.getState());

    expect(preview?.body).toBe(DRAFT_B.body);
    expect(preview?.tags).toEqual(["#美食分享"]);
  });

  it("切换 topic 后下游全部作废，预览消失", () => {
    withFullContent();

    useSession.getState().selectTopic("t2");

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });

  it("重新分析图片后预览消失", () => {
    withFullContent();

    useSession.getState().addImages([makeImage("d")]);

    expect(derivePreviewContent(useSession.getState())).toBeUndefined();
  });
});
