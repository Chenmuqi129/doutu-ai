import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/draft/route";
import { ERROR_CODES } from "@/lib/errors";
import { BODY_MAX, BODY_MIN, TITLE_MAX, TAG_MAX } from "@/lib/rules/constants";

/* ---------------- 测试夹具 ---------------- */

const VALID_SELECTED_TITLE = "农村手工锅巴太香了";

const VALID_BODY =
  "第一次吃到这种手工锅巴是在外婆家，米香很足，咬下去脆而不硬。" +
  "后来才知道是家里人用大锅慢慢烘出来的，一斤米只做得出几袋。";

const VALID_TAGS = ["手工锅巴", "地方美食", "乡村生活"];

const VALID_REQUEST = {
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
  selectedTitle: VALID_SELECTED_TITLE,
};

const TEST_API_KEY = "test-api-key-should-never-leak";

function draftPayload(overrides: { body?: string; tags?: string[] } = {}): unknown {
  return { body: VALID_BODY, tags: VALID_TAGS, ...overrides };
}

// 模型调用通过全局 fetch 拦截；始终复用同一个函数对象，
// 这样即使 OpenAI 客户端被缓存，也能在每次测试里切换响应。
let aiResponder: () => Response = () => completionResponse(JSON.stringify(draftPayload()));

const mockFetch = (async () => aiResponder()) as unknown as typeof fetch;
const fetchSpy = vi.fn(mockFetch);

function completionResponse(content: string, status = 200): Response {
  const body = {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "qwen-plus",
    choices: [
      { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
    ],
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function draftRequest(body: unknown): Request {
  return new Request("http://localhost/api/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function callRoute(body: unknown = VALID_REQUEST) {
  const response = await POST(draftRequest(body));
  const payload = await response.json();
  return { response, payload };
}

/* ---------------- 环境准备 ---------------- */

const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL: process.env.AI_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
};
const originalFetch = globalThis.fetch;

function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

beforeEach(() => {
  process.env.AI_API_KEY = TEST_API_KEY;
  process.env.AI_BASE_URL = "http://127.0.0.1:9/v1";
  setNodeEnv("test");
  globalThis.fetch = fetchSpy;
  fetchSpy.mockClear();
  aiResponder = () => completionResponse(JSON.stringify(draftPayload()));
});

afterEach(() => {
  restoreEnv();
  globalThis.fetch = originalFetch;
});

function restoreEnv() {
  if (originalEnv.AI_API_KEY === undefined) {
    delete process.env.AI_API_KEY;
  } else {
    process.env.AI_API_KEY = originalEnv.AI_API_KEY;
  }
  if (originalEnv.AI_BASE_URL === undefined) {
    delete process.env.AI_BASE_URL;
  } else {
    process.env.AI_BASE_URL = originalEnv.AI_BASE_URL;
  }
  setNodeEnv(originalEnv.NODE_ENV ?? "test");
}

/* ---------------- 测试 ---------------- */

describe("POST /api/draft —— 前置校验", () => {
  it("请求体不是 JSON：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute("不是 JSON");

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("缺少 analysis / brief / topic / selectedTitle 都返回 INVALID_INPUT，且不调用模型", async () => {
    const cases = [
      { brief: VALID_REQUEST.brief, topic: VALID_REQUEST.topic, selectedTitle: VALID_SELECTED_TITLE },
      {
        analysis: VALID_REQUEST.analysis,
        topic: VALID_REQUEST.topic,
        selectedTitle: VALID_SELECTED_TITLE,
      },
      {
        analysis: VALID_REQUEST.analysis,
        brief: VALID_REQUEST.brief,
        selectedTitle: VALID_SELECTED_TITLE,
      },
      { analysis: VALID_REQUEST.analysis, brief: VALID_REQUEST.brief, topic: VALID_REQUEST.topic },
    ];

    for (const body of cases) {
      const { response, payload } = await callRoute(body);
      expect(response.status).toBe(400);
      expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("selectedTitle 为空：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute({ ...VALID_REQUEST, selectedTitle: "" });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("selectedTitle 超过 20 字（valid=false）：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute({
      ...VALID_REQUEST,
      selectedTitle: "字".repeat(TITLE_MAX + 1),
    });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("selectedTitle 只有标点：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute({
      ...VALID_REQUEST,
      selectedTitle: "。。。",
    });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("brief 超过上限：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute({
      ...VALID_REQUEST,
      brief: "字".repeat(1000),
    });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/draft —— 正常生成", () => {
  it("一次调用同时返回正文与标签", async () => {
    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.body).toBe(VALID_BODY);
    expect(payload.data.tags).toEqual(VALID_TAGS.map((tag) => `#${tag}`));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("标签校验结果完整返回（无修正时 changed=false）", async () => {
    const { payload } = await callRoute();

    const validation = payload.data.tagValidation;
    expect(validation.tags).toEqual(payload.data.tags);
    expect(validation.max).toBe(TAG_MAX);
    expect(validation.removed).toEqual([]);
    expect(validation.dropped).toEqual([]);
    expect(validation.duplicates).toEqual([]);
    expect(validation.changed).toBe(false);
  });

  it("标签自动补 # 并做全角 / 空格规范化", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify(draftPayload({ tags: ["手工 锅巴", "＃地方美食", "乡村生活"] })),
      );

    const { payload } = await callRoute();

    expect(payload.data.tags).toEqual(["#手工锅巴", "#地方美食", "#乡村生活"]);
  });

  it("重复标签被合并，duplicates 如实返回", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify(draftPayload({ tags: ["美食", "#美食", "锅巴", "美食"] })),
      );

    const { payload } = await callRoute();

    expect(payload.data.tags).toEqual(["#美食", "#锅巴"]);
    expect(payload.data.tagValidation.duplicates).toEqual(["#美食", "#美食"]);
    expect(payload.data.tagValidation.changed).toBe(true);
  });

  it("标签超过 5 个时按现有规则裁剪，并返回 removed / message", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify(draftPayload({ tags: ["a", "b", "c", "d", "e", "f", "g"] })),
      );

    const { payload } = await callRoute();

    expect(payload.data.tags).toHaveLength(TAG_MAX);
    expect(payload.data.tags).toEqual(["#a", "#b", "#c", "#d", "#e"]);
    expect(payload.data.tagValidation.removed).toEqual(["#f", "#g"]);
    expect(payload.data.tagValidation.removedCount).toBe(2);
    expect(payload.data.tagValidation.changed).toBe(true);
    expect(payload.data.tagValidation.message).toContain("移除 2 个");
  });

  it("无效标签被丢弃，dropped 如实返回", async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(draftPayload({ tags: ["#", "美食", "！"] })));

    const { payload } = await callRoute();

    expect(payload.data.tags).toEqual(["#美食"]);
    expect(payload.data.tagValidation.dropped).toEqual(["#", "！"]);
  });

  it("正文首尾空白被规范化后再保存", async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(draftPayload({ body: `\n  ${VALID_BODY}  \n` })));

    const { payload } = await callRoute();

    expect(payload.data.body).toBe(VALID_BODY);
  });

  it("模型返回 Markdown 代码块包裹的 JSON 仍可解析", async () => {
    aiResponder = () =>
      completionResponse("```json\n" + JSON.stringify(draftPayload()) + "\n```");

    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });
});

describe("POST /api/draft —— 模型输出不合规", () => {
  it("非法 JSON：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () => completionResponse("这不是 JSON");

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("结构不符（缺 body / tags 不是数组）：返回 AI_INVALID_OUTPUT", async () => {
    const cases = [
      { tags: ["美食"] },
      { body: VALID_BODY, tags: "美食" },
      { body: VALID_BODY, tags: [] },
      { body: 123, tags: ["美食"] },
    ];

    for (const badPayload of cases) {
      aiResponder = () => completionResponse(JSON.stringify(badPayload));
      const { response, payload } = await callRoute();
      expect(response.status).toBe(502);
      expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
    }
  });

  it(`正文不足 ${BODY_MIN} 字：返回 AI_INVALID_OUTPUT`, async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(draftPayload({ body: "字".repeat(BODY_MIN - 1) })));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it(`正文超过 ${BODY_MAX} 字：返回 AI_INVALID_OUTPUT，且不截断入库`, async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(draftPayload({ body: "字".repeat(BODY_MAX + 1) })));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
    expect(payload.data).toBeUndefined();
  });

  it("正文只有标点：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(draftPayload({ body: "。".repeat(BODY_MIN) })));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });
});

describe("POST /api/draft —— AI 层错误", () => {
  it("AI 未配置：返回 AI_NOT_CONFIGURED，不发起模型请求", async () => {
    delete process.env.AI_API_KEY;

    const { response, payload } = await callRoute();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe(ERROR_CODES.AI_NOT_CONFIGURED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("上游 500：返回 AI_UPSTREAM_ERROR", async () => {
    aiResponder = () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_UPSTREAM_ERROR);
  });

  it("网络错误：返回 NETWORK_ERROR", async () => {
    aiResponder = () => {
      throw new TypeError("fetch failed");
    };

    const { response, payload } = await callRoute();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe(ERROR_CODES.NETWORK_ERROR);
  });

  it("连接超时：返回 AI_TIMEOUT", async () => {
    aiResponder = () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    };

    const { response, payload } = await callRoute();

    expect(response.status).toBe(504);
    expect(payload.error.code).toBe(ERROR_CODES.AI_TIMEOUT);
  });
});

describe("POST /api/draft —— 成本与安全", () => {
  it("一次点击只产生一次模型调用（正文与标签同一次产出）", async () => {
    await callRoute();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("模型调用失败时不自动重试", async () => {
    aiResponder = () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    await callRoute();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("上游请求里没有图片，只有文本上下文与已选标题", async () => {
    await callRoute();

    const serialized = JSON.stringify(fetchSpy.mock.calls);
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("base64");
    expect(serialized).toContain(VALID_SELECTED_TITLE);
  });

  it("成功响应里不包含 API Key", async () => {
    const { payload } = await callRoute();
    expect(JSON.stringify(payload)).not.toContain(TEST_API_KEY);
  });

  it("生产环境剥离 detail，不暴露内部实现信息", async () => {
    setNodeEnv("production");

    const { payload } = await callRoute({ analysis: VALID_REQUEST.analysis });

    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(payload.error.detail).toBeUndefined();
  });

  it("生产环境下 AI 输出异常也不暴露字段路径", async () => {
    setNodeEnv("production");
    aiResponder = () => completionResponse(JSON.stringify({ body: "太短" }));

    const { payload } = await callRoute();

    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
    expect(payload.error.detail).toBeUndefined();
  });
});
