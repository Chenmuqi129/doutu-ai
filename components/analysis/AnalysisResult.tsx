"use client";

import { useSession } from "@/lib/store/useSession";

// 素材分析结果展示（P2）：摘要 / 视觉标签 / 受众 / Brief。
export function AnalysisResult() {
  const analysis = useSession((state) => state.analysis);
  const brief = useSession((state) => state.brief);

  if (!analysis) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <h2 className="text-base font-medium">2. 素材分析</h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">素材摘要</span>
        <p className="text-sm">{analysis.materialSummary}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">视觉标签</span>
        <ul className="flex flex-wrap gap-2">
          {analysis.visualTags.map((tag) => (
            <li key={tag} className="rounded-full bg-muted px-3 py-1 text-xs">
              {tag}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">可能受众</span>
        <p className="text-sm">{analysis.audience}</p>
      </div>

      {brief ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Brief（供后续步骤复用）</span>
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{brief}</p>
        </div>
      ) : null}
    </section>
  );
}
