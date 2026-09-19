"use client";

import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Button } from "@/components/ui/button";
import { TITLE_COUNT, TITLE_MAX } from "@/lib/rules/constants";
import { useSession } from "@/lib/store/useSession";
import type { GeneratedTitle } from "@/lib/types";

import { useTitles } from "./useTitles";

// 标题生成区（P3-A）：生成候选标题 → 展示字数与不合格原因 → 选择一个合格标题。
// 组件只消费 store，选标题是纯本地操作，不会触发任何 API 调用。
export function TitlePicker() {
  const topics = useSession((state) => state.topics);
  const selectedTopicId = useSession((state) => state.selectedTopicId);
  const titles = useSession((state) => state.titles);
  const selectedTitle = useSession((state) => state.selectedTitle);
  const titlesStatus = useSession((state) => state.titlesStatus);
  const titlesError = useSession((state) => state.titlesError);
  const selectTitle = useSession((state) => state.selectTitle);
  const { runTitles } = useTitles();

  const selectedTopic = topics?.find((topic) => topic.id === selectedTopicId);

  if (!selectedTopic) {
    return null;
  }

  const isGenerating = titlesStatus === "loading";
  const titleList = titles ?? [];
  const hasTitles = titleList.length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">4. 生成标题</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            围绕「{selectedTopic.title}」生成 {TITLE_COUNT} 条候选标题，只有不超过 {TITLE_MAX}{" "}
            字的标题才能被选中。
          </p>
        </div>
        <Button type="button" onClick={() => void runTitles()} disabled={isGenerating}>
          {isGenerating ? "AI 正在写标题…" : hasTitles ? "重新生成标题" : "生成标题"}
        </Button>
      </div>

      {titlesError ? (
        <ErrorBanner message={titlesError} onRetry={() => void runTitles()} />
      ) : null}

      {hasTitles ? (
        <ul className="flex flex-col gap-2">
          {titleList.map((title, index) => (
            <TitleRow
              key={`${index}-${title.text}`}
              title={title}
              selected={title.text === selectedTitle}
              onSelect={selectTitle}
            />
          ))}
        </ul>
      ) : !isGenerating && !titlesError ? (
        <p className="text-sm text-muted-foreground">
          还没有候选标题，点击「生成标题」开始。
        </p>
      ) : null}
    </section>
  );
}

function TitleRow({
  title,
  selected,
  onSelect,
}: {
  title: GeneratedTitle;
  selected: boolean;
  onSelect: (text: string) => void;
}) {
  const unusable = !title.valid;

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
        selected ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {title.style ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {title.style}
            </span>
          ) : null}
          <span className={`text-sm ${unusable ? "text-muted-foreground" : ""}`}>
            {title.text.length > 0 ? title.text : "（空标题）"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={unusable ? "text-destructive" : undefined}>
            {title.count} / {title.max} 字
          </span>
          {unusable ? <span className="text-destructive">{describeIssue(title)}</span> : null}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant={selected ? "default" : "outline"}
        disabled={unusable}
        onClick={() => onSelect(title.text)}
      >
        {selected ? "已选择" : unusable ? "不可选" : "使用这个标题"}
      </Button>
    </li>
  );
}

/** 把 validateTitle 给出的 reason 翻成用户能看懂的一句话。 */
function describeIssue(title: GeneratedTitle): string {
  if (title.reason === "TITLE_TOO_LONG") {
    return `超过 ${title.max} 字，请重新生成`;
  }
  if (title.reason === "TITLE_EMPTY") {
    return "没有有效内容";
  }
  return "未通过校验";
}
