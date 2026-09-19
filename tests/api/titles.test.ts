import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/titles/route";
import { ERROR_CODES } from "@/lib/errors";
import { BRIEF_MAX, TITLE_COUNT, TITLE_MAX } from "@/lib/rules/constants";
import { countChars } from "@/lib/rules/text";

/* ---------------- 测试夹具 ---------------- */

const TITLE_STYLES = ["悬念", "干货", "共鸣", "反差", "清单"] as const;

const VALID_TITLES = [
  "农村手工锅巴太香了",
  "15元一斤的锅巴值不值",
  "家里怎么做手工锅巴",
  "小时候的锅巴味道回来了",
  "三分钟学会挑锅巴",
];

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
};

const TEST_API_KEY = "test-api-key-should-never-leak";

function titlesPayload(texts: string[]): unknown {
  return {
    titles: texts.map((text, index) => ({
      text,
      style: TITLE_STYLES[index % TITLE_STYLES.length],
    })),
  };
}

// 模型调用通过全局 fetch 拦截；始终复用同一个函数对象，
// 这样即使 OpenAI 客户端被缓存，也能在每次测试里切换响应。
let aiResponder: () => Response = () =>
  completionResponse(JSON.stringify(titlesPayload(VALID_TITLES)));

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

function titlesRequest(body: unknown): Request {
  return new Request("http://localhost/api/titles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function callRoute(body: unknown = VALID_REQUEST) {
  const response = await POST(titlesRequest(body));
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
  aiResponder = () => completionResponse(JSON.stringify(titlesPayload(VALID_TITLES)));
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

describe("POST /api/titles —— 请求校验", () => {
  it("请求体不是 JSON：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute("不是 JSON");

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("缺少 analysis / brief / topic 都返回 INVALID_INPUT，且不调用模型", async () => {
    const missingAnalysis = { brief: VALID_REQUEST.brief, topic: VALID_REQUEST.topic };
    const missingBrief = { analysis: VALID_REQUEST.analysis, topic: VALID_REQUEST.topic };
    const missingTopic = { analysis: VALID_REQUEST.analysis, brief: VALID_REQUEST.brief };

    for (const body of [missingAnalysis, missingBrief, missingTopic]) {
      const { response, payload } = await callRoute(body);
      expect(response.status).toBe(400);
      expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("brief 超过上限：返回 INVALID_INPUT，且不调用模型", async () => {
    const { response, payload } = await callRoute({
      ...VALID_REQUEST,
      brief: "字".repeat(BRIEF_MAX + 1),
    });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("topic 结构不完整：返回 INVALID_INPUT", async () => {
    const { response, payload } = await callRoute({
      ...VALID_REQUEST,
      topic: { id: "t1", title: "只有标题" },
    });

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
  });
});

describe("POST /api/titles —— 正常生成", () => {
  it("返回 TITLE_COUNT 条候选标题，且每条都带规则校验信息", async () => {
    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.titles).toHaveLength(TITLE_COUNT);

    for (const title of payload.data.titles) {
      expect(title.valid).toBe(true);
      expect(title.max).toBe(TITLE_MAX);
      expect(title.text).toBe(title.normalized);
      expect(title.count).toBe(countChars(title.text));
      expect(title.reason).toBeUndefined();
    }
  });

  it("count / valid 由程序计算，模型自报的字段不被采信", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify({
          titles: VALID_TITLES.map((text) => ({ text, style: "悬念", count: 999, valid: false })),
        }),
      );

    const { payload } = await callRoute();

    expect(payload.data.titles[0].count).toBe(countChars(VALID_TITLES[0]));
    expect(payload.data.titles[0].count).not.toBe(999);
    expect(payload.data.titles[0].valid).toBe(true);
  });

  it("超过 20 字的标题被识别为无效，且不截断、仍保留在结果里", async () => {
    const overlong = "字".repeat(TITLE_MAX + 1);
    aiResponder = () =>
      completionResponse(JSON.stringify(titlesPayload([overlong, ...VALID_TITLES.slice(1)])));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.data.titles).toHaveLength(TITLE_COUNT);

    const first = payload.data.titles[0];
    expect(first.valid).toBe(false);
    expect(first.reason).toBe("TITLE_TOO_LONG");
    expect(first.count).toBe(TITLE_MAX + 1);
    expect(first.max).toBe(TITLE_MAX);
    expect(first.normalized).toBe(overlong);
    expect(first.text).toBe(overlong);
    expect(first.text).toHaveLength(TITLE_MAX + 1);
  });

  it("模型返回 Markdown 代码块包裹的 JSON 仍可解析", async () => {
    aiResponder = () =>
      completionResponse("```json\n" + JSON.stringify(titlesPayload(VALID_TITLES)) + "\n```");

    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("未知 style 被降级为 undefined，不影响标题本身", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify({
          titles: VALID_TITLES.map((text) => ({ text, style: "抒情" })),
        }),
      );

    const { response, payload } = await callRoute();

    expect(response.status).toBe(200);
    expect(payload.data.titles[0].style).toBeUndefined();
    expect(payload.data.titles[0].valid).toBe(true);
  });
});

describe("POST /api/titles —— AI 层错误", () => {
  it("AI 未配置：返回 AI_NOT_CONFIGURED，不发起模型请求", async () => {
    delete process.env.AI_API_KEY;

    const { response, payload } = await callRoute();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe(ERROR_CODES.AI_NOT_CONFIGURED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("模型返回非法 JSON：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () => completionResponse("这不是 JSON");

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("模型返回空标题列表：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () => completionResponse(JSON.stringify({ titles: [] }));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("标题数量不是 TITLE_COUNT：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () =>
      completionResponse(JSON.stringify(titlesPayload(VALID_TITLES.slice(0, TITLE_COUNT - 1))));

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("所有标题都超过 20 字：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify(titlesPayload(Array.from({ length: TITLE_COUNT }, () => "字".repeat(30)))),
      );

    const { response, payload } = await callRoute();

    expect(response.status).toBe(502);
    expect(payload.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
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
});

describe("POST /api/titles —— 成本与安全", () => {
  it("一次点击只产生一次模型调用（不自动重试）", async () => {
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

  it("成功响应里不包含 API Key", async () => {
    const { payload } = await callRoute();
    expect(JSON.stringify(payload)).not.toContain(TEST_API_KEY);
  });

  it("错误响应里不包含 API Key", async () => {
    delete process.env.AI_API_KEY;

    const { payload } = await callRoute();
    expect(JSON.stringify(payload)).not.toContain(TEST_API_KEY);
  });

  it("生产环境剥离 detail，不暴露内部信息", async () => {
    setNodeEnv("production");

    const { payload } = await callRoute({ analysis: VALID_REQUEST.analysis });

    expect(payload.error.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(payload.error.detail).toBeUndefined();
  });
});
