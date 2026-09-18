import { Button } from "@/components/ui/button";

/**
 * P0 临时占位页。
 *
 * 用途：验证项目可启动、Tailwind 与 shadcn/ui 可用、/api/health 可达。
 * P3 会用真正的 5 步向导（上传 → 选题 → 标题 → 正文 → 预览）替换本页。
 */

const P0_SCOPE = [
  "Next.js 16 + TypeScript + Tailwind CSS v4 脚手架",
  "shadcn/ui 初始化（nova 预设 + radix 基础组件）",
  "目录骨架：components/* 与 lib/* 按功能分组",
  "lib/rules/constants.ts —— 规则常量唯一来源",
  "lib/errors/ —— 错误码与用户文案映射",
  "lib/types/ —— 会话状态与三次 AI 调用的接口契约",
  "GET /api/health —— 服务自检，暂不调用真实 AI",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">P0 · 项目骨架</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">抖图 AI</h1>
        <p className="text-muted-foreground">
          上传图片，AI 帮你判断适合发什么、怎么写标题、正文和标签，并在发布前自动检查格式。
        </p>
      </header>

      <section className="rounded-xl border p-6">
        <h2 className="text-sm font-medium">P0 已完成</h2>
        <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
          {P0_SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href="/api/health">查看 /api/health</a>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        完整工作流界面（上传 → 选题 → 标题 → 正文 → 标签 → 预览）将在 P2 / P3 实现，本页是 P0 临时占位页。
      </p>
    </main>
  );
}
