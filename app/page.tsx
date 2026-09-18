import { Workspace } from "@/components/shared/Workspace";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">P2 · 素材分析链路</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">抖图 AI</h1>
        <p className="text-muted-foreground">
          上传图片，AI 帮你判断适合发什么、怎么写标题、正文和标签，并在发布前自动检查格式。
        </p>
      </header>

      <Workspace />

      <p className="text-xs text-muted-foreground">
        标题生成、正文与标签、发布预览将在 P3 实现。
      </p>
    </main>
  );
}
