import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRegisteredUploadCount, registerUploadBlob } from "@/lib/image/uploadRegistry";
import {
  SESSION_STORAGE_KEY,
  useSession,
} from "@/lib/store/useSession";
import type { MaterialAnalysisResult, SessionImage } from "@/lib/types";

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

function persistedState(): Record<string, unknown> | undefined {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (raw === null) {
    return undefined;
  }
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state;
}

const revokeSpy = vi.fn();
const originalRevoke = URL.revokeObjectURL;

beforeEach(() => {
  useSession.getState().resetSession();
  localStorage.clear();
  revokeSpy.mockClear();
  URL.revokeObjectURL = revokeSpy;
});

afterEach(() => {
  URL.revokeObjectURL = originalRevoke;
});

describe("useSession —— 基础状态", () => {
  it("初始状态：没有图片、step 为 upload、stale 全为 false", () => {
    const state = useSession.getState();

    expect(state.images).toEqual([]);
    expect(state.step).toBe("upload");
    expect(state.stale).toEqual({ titles: false, draft: false });
    expect(state.analyzeStatus).toBe("idle");
  });

  it("addImages 追加图片并保留元数据", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b")]);

    const state = useSession.getState();
    expect(state.images).toHaveLength(2);
    expect(state.images[0].fileName).toBe("a.jpg");
    expect(state.images[0].width).toBe(1280);
  });

  it("removeImage 删除指定图片并释放登记表与 ObjectURL", () => {
    registerUploadBlob("a", new Blob(["x"], { type: "image/jpeg" }));
    useSession.getState().addImages([makeImage("a"), makeImage("b")]);
    expect(getRegisteredUploadCount()).toBe(1);

    useSession.getState().removeImage("a");

    expect(useSession.getState().images.map((image) => image.id)).toEqual(["b"]);
    expect(getRegisteredUploadCount()).toBe(0);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-a");
  });

  it("clearImages 清空图片并释放全部 ObjectURL", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b")]);

    useSession.getState().clearImages();

    expect(useSession.getState().images).toEqual([]);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-a");
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-b");
  });
});

describe("useSession —— 持久化边界（M14）", () => {
  it("images 不会进入 localStorage", () => {
    useSession.getState().addImages([makeImage("a")]);

    const persisted = persistedState();
    expect(persisted).toBeDefined();
    expect(persisted).not.toHaveProperty("images");
    expect(JSON.stringify(persisted)).not.toContain("blob:mock-a");
    expect(JSON.stringify(persisted)).not.toContain("objectUrl");
  });

  it("分析结果等文本状态会进入 localStorage", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    const persisted = persistedState();
    expect(persisted?.analysis).toEqual(ANALYSIS_RESULT.analysis);
    expect(persisted?.brief).toBe(ANALYSIS_RESULT.brief);
    expect(persisted?.topics).toHaveLength(3);
  });

  it("analyzeStatus / analyzeError 不会进入 localStorage", () => {
    useSession.getState().setAnalyzeStatus("error", "出错了");

    const persisted = persistedState();
    expect(persisted).not.toHaveProperty("analyzeStatus");
    expect(persisted).not.toHaveProperty("analyzeError");
  });

  it("图片不会通过 ObjectURL 字符串间接泄漏到持久化数据里", () => {
    useSession.getState().addImages([makeImage("secret")]);
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    expect(JSON.stringify(persistedState())).not.toContain("secret");
  });
});

describe("useSession —— Stale Matrix", () => {
  it("applyAnalysis 写入 analysis / topics / brief 并重置 stale", () => {
    useSession.setState({ stale: { titles: true, draft: true } });

    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    const state = useSession.getState();
    expect(state.analysis).toEqual(ANALYSIS_RESULT.analysis);
    expect(state.topics).toHaveLength(3);
    expect(state.brief).toBe(ANALYSIS_RESULT.brief);
    expect(state.stale).toEqual({ titles: false, draft: false });
    expect(state.step).toBe("topics");
  });

  it("重新上传图片会使 analysis / topics / brief 全部作废", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);
    useSession.getState().selectTopic("t2");

    useSession.getState().addImages([makeImage("a")]);

    const state = useSession.getState();
    expect(state.analysis).toBeUndefined();
    expect(state.topics).toBeUndefined();
    expect(state.brief).toBeUndefined();
    expect(state.selectedTopicId).toBeUndefined();
    expect(state.step).toBe("upload");
  });

  it("删除图片同样使分析结果作废", () => {
    useSession.getState().addImages([makeImage("a"), makeImage("b")]);
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    useSession.getState().removeImage("a");

    expect(useSession.getState().analysis).toBeUndefined();
    expect(useSession.getState().topics).toBeUndefined();
  });

  it("若已存在标题或正文，上传图片会标记 titles / draft 过期", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);
    useSession.setState({
      titles: [{ text: "旧标题", count: 3, valid: true }],
      selectedTitle: "旧标题",
      draft: { body: "旧正文", tags: ["#美食"] },
    });

    useSession.getState().addImages([makeImage("a")]);

    expect(useSession.getState().stale).toEqual({ titles: true, draft: true });
  });

  it("还没有下游内容时上传图片不会误报过期", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    useSession.getState().addImages([makeImage("a")]);

    expect(useSession.getState().stale).toEqual({ titles: false, draft: false });
  });

  it("更换选题：analysis / topics / brief 保留，标题与正文作废", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);
    useSession.getState().selectTopic("t1");
    useSession.setState({
      titles: [{ text: "旧标题", count: 3, valid: true }],
      selectedTitle: "旧标题",
      draft: { body: "旧正文", tags: ["#美食"] },
    });

    useSession.getState().selectTopic("t3");

    const state = useSession.getState();
    expect(state.selectedTopicId).toBe("t3");
    expect(state.analysis).toEqual(ANALYSIS_RESULT.analysis);
    expect(state.topics).toHaveLength(3);
    expect(state.brief).toBe(ANALYSIS_RESULT.brief);
    expect(state.titles).toBeUndefined();
    expect(state.selectedTitle).toBeUndefined();
    expect(state.draft).toBeUndefined();
    expect(state.stale).toEqual({ titles: true, draft: true });
  });

  it("首次选择选题不会误报过期", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    useSession.getState().selectTopic("t1");

    expect(useSession.getState().selectedTopicId).toBe("t1");
    expect(useSession.getState().stale).toEqual({ titles: false, draft: false });
  });

  it("选择不存在的选题 id 不改变状态", () => {
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);

    useSession.getState().selectTopic("not-exist");

    expect(useSession.getState().selectedTopicId).toBeUndefined();
  });
});

describe("useSession —— 重置", () => {
  it("resetSession 清空全部状态与临时图片资源", () => {
    registerUploadBlob("a", new Blob(["x"], { type: "image/jpeg" }));
    useSession.getState().addImages([makeImage("a")]);
    useSession.getState().applyAnalysis(ANALYSIS_RESULT);
    useSession.getState().selectTopic("t1");

    useSession.getState().resetSession();

    const state = useSession.getState();
    expect(state.images).toEqual([]);
    expect(state.analysis).toBeUndefined();
    expect(state.topics).toBeUndefined();
    expect(state.selectedTopicId).toBeUndefined();
    expect(state.step).toBe("upload");
    expect(state.stale).toEqual({ titles: false, draft: false });
    expect(getRegisteredUploadCount()).toBe(0);
  });
});
