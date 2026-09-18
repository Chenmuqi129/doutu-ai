"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/store/useSession";

// 选题列表（P2）：展示 3 个选题并允许用户选择一个。
export function TopicPicker() {
  const topics = useSession((state) => state.topics);
  const selectedTopicId = useSession((state) => state.selectedTopicId);
  const selectTopic = useSession((state) => state.selectTopic);

  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div>
        <h2 className="text-base font-medium">3. 选择一个选题</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          挑选一个最想拍的方向，后续标题与正文都会围绕它生成。
        </p>
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        {topics.map((topic) => {
          const selected = topic.id === selectedTopicId;
          return (
            <li
              key={topic.id}
              className={`flex flex-col gap-2 rounded-lg border p-4 ${
                selected ? "border-primary bg-primary/5" : ""
              }`}
            >
              <span className="text-xs text-muted-foreground">{topic.id}</span>
              <h3 className="text-sm font-medium">{topic.title}</h3>
              <p className="text-sm text-muted-foreground">{topic.description}</p>
              <p className="text-xs text-muted-foreground">角度：{topic.angle}</p>
              <Button
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="mt-auto"
                onClick={() => selectTopic(topic.id)}
              >
                {selected ? "已选择" : "使用这个选题"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
