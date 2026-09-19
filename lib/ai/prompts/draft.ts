import { BODY_MAX, BODY_MIN, TAG_MAX } from "@/lib/rules/constants";
import type { MaterialAnalysis, Topic } from "@/lib/types";

/**
 * 正文 + 标签生成 Prompt（P3-B：/api/draft 唯一的一次文本模型调用）。
 *
 * 设计要求：
 *   - 正文与标签必须由这一次调用同时产出，不允许拆成两次请求；
 *   - 正文长短、标签数量都来自 lib/rules/constants.ts，本文件不写死 20 / 1200 / 5；
 *   - 模型不负责判定合格与否，最终一律以服务端规则层为准。
 */

export const DRAFT_SYSTEM_PROMPT = `你是「抖图 AI」的抖音图文文案编辑。
用户已经选定标题，请基于素材分析、内容 Brief 和选题，一次性写出配套的正文与话题标签。

【正文要求】
- 正文长度 ${BODY_MIN}～${BODY_MAX} 字（少于 ${BODY_MIN} 字或多于 ${BODY_MAX} 字都会被程序判为不合格）。
- 纯文本、口语化，可以用换行分段；不要写小标题、不要用编号列表、不要使用 Markdown 语法。
- 正文里不要出现 # 话题标签，标签只放在 tags 字段。
- 围绕已选标题展开，但不要直接复述标题本身。
- 只使用给定素材里出现过的信息，不要编造价格、地点、人物或数据。
- 结尾不要写「点赞关注」之类的引导语。

【标签要求】
- 给出与内容相关的抖音话题词，按相关性从高到低排序，数量不超过 ${TAG_MAX} 个。
- 标签只写词本身，不要带 # 前缀，不要包含空格或标点。

【输出格式】
只输出一个 JSON 对象，不要输出 Markdown 代码块（不要 \`\`\`），不要输出任何解释文字。
JSON 结构必须严格如下：
{
  "body": "……",
  "tags": ["标签一", "标签二"]
}`;

/** 与 system prompt 一起发送的用户消息：素材分析 + Brief + 已选选题 + 已选标题。 */
export function buildDraftUserText(input: {
  analysis: MaterialAnalysis;
  brief: string;
  topic: Topic;
  selectedTitle: string;
}): string {
  const { analysis, brief, topic, selectedTitle } = input;

  const lines = [
    "【素材分析】",
    `- 素材摘要：${analysis.materialSummary}`,
    `- 视觉标签：${analysis.visualTags.join("、")}`,
    `- 可能受众：${analysis.audience}`,
    "",
    "【内容 Brief】",
    brief,
    "",
    "【已选选题】",
    `- 选题名称：${topic.title}`,
    `- 选题说明：${topic.description}`,
    `- 内容角度：${topic.angle}`,
    "",
    "【已选标题】",
    selectedTitle,
  ];

  lines.push("", "请按系统指令输出 JSON。");

  return lines.join("\n");
}
