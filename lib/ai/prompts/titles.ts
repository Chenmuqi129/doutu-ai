import { TITLE_COUNT, TITLE_MAX, TITLE_TARGET } from "@/lib/rules/constants";
import { TITLE_STYLES, type MaterialAnalysis, type Topic } from "@/lib/types";

/**
 * 标题生成 Prompt（P3-A：/api/titles 唯一的一次文本模型调用）。
 *
 * 设计要求：
 *   - 只生成候选标题，不写正文、不生成标签、不给发布建议；
 *   - 字数上限只作为「写作目标」告诉模型，最终是否合格永远由 validateTitle() 判定；
 *   - 数量与上限全部来自 lib/rules/constants.ts，本文件不写死 20 / 5。
 */

const STYLE_LIST = TITLE_STYLES.join("、");

export const TITLES_SYSTEM_PROMPT = `你是「抖图 AI」的抖音图文标题撰写专家。
用户会给你一份素材分析、一段内容 Brief，以及他已经选定的内容选题。请围绕该选题写出 ${TITLE_COUNT} 条候选标题。

【硬性要求】
- 每条标题控制在 ${TITLE_TARGET} 字以内（项目上限 ${TITLE_MAX} 字；超过 ${TITLE_MAX} 字会被程序判为不合格，无法被选用）。
- 不要出现 # 或任何话题标签。
- 不要换行、不要编号、不要用引号包裹、不要输出 Markdown。
- ${TITLE_COUNT} 条标题必须角度不同，并分别对应这 ${TITLE_COUNT} 种风格：${STYLE_LIST}。
- 标题要具体、有画面感、口语化，符合抖音图文的表达习惯，避免空泛套话。
- 只使用给定素材里出现过的信息，不要编造价格、地点、人物或数据。

【输出格式】
只输出一个 JSON 对象，不要输出 Markdown 代码块（不要 \`\`\`），不要输出任何解释文字。
JSON 结构必须严格如下：
{
  "titles": [
    { "text": "……", "style": "悬念" }
  ]
}
titles 必须恰好 ${TITLE_COUNT} 条，style 只能取：${STYLE_LIST}。`;

/** 与 system prompt 一起发送的用户消息：素材分析 + Brief + 已选选题。 */
export function buildTitlesUserText(input: {
  analysis: MaterialAnalysis;
  brief: string;
  topic: Topic;
}): string {
  const { analysis, brief, topic } = input;

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
  ];

  if (topic.hook) {
    lines.push(`- 钩子句：${topic.hook}`);
  }

  lines.push("", `请按系统指令输出 JSON，titles 恰好 ${TITLE_COUNT} 条。`);

  return lines.join("\n");
}
