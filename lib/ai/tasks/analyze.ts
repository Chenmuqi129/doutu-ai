import { AppError, ERROR_CODES } from "@/lib/errors";
import type { MaterialAnalysisResult } from "@/lib/types";

import { getAIClient, toAIError } from "../client";
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserText } from "../prompts/analyze";
import { getAIConfig } from "../providers";
import { AnalyzeResponseSchema } from "../schemas/analyze";

/**
 * 素材分析任务：把已经处理好的图片交给视觉模型，产出一份类型安全的分析结果。
 *
 * 成本约束（P2 §7 / §16）：
 *   - 整个任务只调用一次模型；
 *   - 不做自动重试、不做循环调用、不并行调用多个模型；
 *   - 解析或校验失败直接抛错，由用户主动点击重新分析。
 *
 * 职责边界：这里只做「调用 + 解析 + 校验」，
 * 标题 20 字、标签 5 个之类的业务规则一律不写进本文件。
 */

export type AnalyzeImageInput = {
  /** 不含 data: 前缀的 base64 */
  base64: string;
  mimeType: string;
};

/** 模型实际使用的采样温度：选题需要一定发散度。 */
const ANALYZE_TEMPERATURE = 0.8;

export async function analyzeMaterial(
  images: AnalyzeImageInput[],
): Promise<MaterialAnalysisResult> {
  // 未配置 API Key 时在这里就抛 AI_NOT_CONFIGURED，不会发起任何网络请求
  const config = getAIConfig();
  const client = getAIClient();

  const userContent = [
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })),
    {
      type: "text" as const,
      text: buildAnalyzeUserText(images.length),
    },
  ];

  let raw: string | null | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: config.visionModel,
      temperature: ANALYZE_TEMPERATURE,
      messages: [
        { role: "system", content: ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    raw = completion.choices[0]?.message?.content;
  } catch (error) {
    throw toAIError(error);
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, { detail: "模型返回内容为空" });
  }

  const json = extractJsonObject(raw);
  const parsed = AnalyzeResponseSchema.safeParse(json);

  if (!parsed.success) {
    // detail 只记录出错字段路径，不记录模型原文（避免把用户素材写进日志）
    const paths = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .slice(0, 6)
      .join("、");
    throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, {
      detail: `字段校验失败：${paths}`,
    });
  }

  // 赋值给契约类型，顺带完成编译期的结构一致性检查
  const data: MaterialAnalysisResult = parsed.data;
  return data;
}

/**
 * 从模型返回的文本里提取 JSON 对象。
 *
 * 只做「解析」不做「改写」：允许模型多包一层 Markdown 代码块或前后带少量说明文字，
 * 但绝不修改 JSON 内部的字段内容；内容本身是否合规由 Zod 判定。
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  const direct = tryParseJson(candidate);
  if (direct.ok) {
    return direct.value;
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = tryParseJson(candidate.slice(start, end + 1));
    if (sliced.ok) {
      return sliced.value;
    }
  }

  throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, {
    detail: "模型返回内容不是合法 JSON",
  });
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
