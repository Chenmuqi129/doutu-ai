import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/analyze/route";
import { ERROR_CODES } from "@/lib/errors";
import { IMAGE_MAX, IMAGE_MAX_BYTES } from "@/lib/rules/constants";

/* ---------------- 测试夹具 ---------------- */

const VALID_PAYLOAD = {
  analysis: {
    materialSummary: "家庭制作的手工大米锅巴，包含成品特写与包装照片。",
    visualTags: ["手工食品", "锅巴", "乡村生活"],
    audience: "喜欢地方美食与手工食品的用户",
  },
  topics: [
    { id: "t1", title: "农村手工锅巴分享", description: "记录家里的手工锅巴", angle: "真实生活" },
    { id: "t2", title: "15 元一斤的锅巴", description: "聊聊价格与用料", angle: "价格卖点" },
    { id: "t3", title: "家里怎么做锅巴", description: "展示制作过程", angle: "制作过程" },
  ],
  brief: "这是一份家庭手工锅巴素材，画面朴素，适合用真实生活的语气讲述。",
};

const TEST_API_KEY = "test-api-key-should-never-leak";

// 模型调用通过全局 fetch 拦截；始终复用同一个函数对象，
// 这样即使 OpenAI 客户端被缓存，也能在每次测试里切换响应。
let aiResponder: () => Response = () => completionResponse(JSON.stringify(VALID_PAYLOAD));

const mockFetch = (async () => aiResponder()) as unknown as typeof fetch;
const fetchSpy = vi.fn(mockFetch);

function completionResponse(content: string, status = 200): Response {
  const body = {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "qwen-vl-max",
    choices: [
      { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
    ],
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function imageFile(name = "photo.jpg", type = "image/jpeg", size = 64): File {
  return new File([new Uint8Array(size)], name, { type });
}

function buildFormData(files: File[]): FormData {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  return formData;
}

function analyzeRequest(files: File[]): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: buildFormData(files),
  });
}

async function callRoute(files: File[]) {
  const response = await POST(analyzeRequest(files));
  const body = await response.json();
  return { response, body };
}

/* ---------------- 环境准备 ---------------- */

const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL: process.env.AI_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
};
const originalFetch = globalThis.fetch;

// @types/node 把 NODE_ENV 标为只读，测试里需要按用例切换，因此走可变视图
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

beforeEach(() => {
  process.env.AI_API_KEY = TEST_API_KEY;
  process.env.AI_BASE_URL = "http://127.0.0.1:9/v1";
  setNodeEnv("test");
  globalThis.fetch = fetchSpy;
  fetchSpy.mockClear();
  aiResponder = () => completionResponse(JSON.stringify(VALID_PAYLOAD));
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

describe("POST /api/analyze —— 图片校验", () => {
  it("0 张图片：返回 NO_IMAGE_UPLOADED，且不调用模型", async () => {
    const { response, body } = await callRoute([]);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.NO_IMAGE_UPLOADED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("1 张图片：成功返回 analysis + topics + brief", async () => {
    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.analysis.materialSummary).toBe(VALID_PAYLOAD.analysis.materialSummary);
    expect(body.data.topics).toHaveLength(3);
    expect(body.data.brief).toBe(VALID_PAYLOAD.brief);
  });

  it("9 张图片：允许，且返回契约结构正确", async () => {
    const files = Array.from({ length: IMAGE_MAX }, (_, index) =>
      imageFile(`photo-${index}.jpg`),
    );
    const { response, body } = await callRoute(files);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.topics.map((topic: { id: string }) => topic.id)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("10 张图片：返回 TOO_MANY_IMAGES，且不调用模型", async () => {
    const files = Array.from({ length: IMAGE_MAX + 1 }, (_, index) =>
      imageFile(`photo-${index}.jpg`),
    );
    const { response, body } = await callRoute(files);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.TOO_MANY_IMAGES);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("不支持的 MIME：返回 UNSUPPORTED_IMAGE_TYPE", async () => {
    const { response, body } = await callRoute([imageFile("note.txt", "text/plain")]);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.UNSUPPORTED_IMAGE_TYPE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("单张文件过大：返回 IMAGE_TOO_LARGE", async () => {
    const { response, body } = await callRoute([
      imageFile("huge.jpg", "image/jpeg", IMAGE_MAX_BYTES + 1),
    ]);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.IMAGE_TOO_LARGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("请求体不是 multipart：返回 INVALID_INPUT", async () => {
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [] }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.INVALID_INPUT);
  });
});

describe("POST /api/analyze —— AI 层错误", () => {
  it("AI 未配置：返回 AI_NOT_CONFIGURED，不发起模型请求", async () => {
    delete process.env.AI_API_KEY;

    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.AI_NOT_CONFIGURED);
    expect(body.error.retryable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AI 返回非法 JSON：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () => completionResponse("这不是 JSON");

    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("AI 返回合法 JSON 但结构不符：返回 AI_INVALID_OUTPUT", async () => {
    aiResponder = () =>
      completionResponse(
        JSON.stringify({
          analysis: { materialSummary: "摘要", visualTags: ["标签"], audience: "受众" },
          topics: [{ id: "t1", title: "标题" }],
          brief: "brief",
        }),
      );

    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe(ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it("上游 500：返回 AI_UPSTREAM_ERROR", async () => {
    aiResponder = () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe(ERROR_CODES.AI_UPSTREAM_ERROR);
  });

  it("模型返回 Markdown 代码块包裹的 JSON 仍可解析", async () => {
    aiResponder = () =>
      completionResponse("```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```");

    const { response, body } = await callRoute([imageFile()]);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe("POST /api/analyze —— 成本与安全", () => {
  it("一次点击只产生一次模型调用（不自动重试）", async () => {
    await callRoute([imageFile(), imageFile("b.jpg")]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("模型调用失败时不自动重试", async () => {
    aiResponder = () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    await callRoute([imageFile()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("成功响应里不包含 API Key", async () => {
    const { body } = await callRoute([imageFile()]);
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
  });

  it("错误响应里不包含 API Key 与图片 base64", async () => {
    delete process.env.AI_API_KEY;
    const { body } = await callRoute([imageFile()]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(TEST_API_KEY);
    expect(serialized).not.toContain("base64");
  });

  it("生产环境剥离 detail，不暴露内部信息", async () => {
    setNodeEnv("production");

    const { body } = await callRoute([imageFile("note.txt", "text/plain")]);

    expect(body.error.code).toBe(ERROR_CODES.UNSUPPORTED_IMAGE_TYPE);
    expect(body.error.detail).toBeUndefined();
  });
});
