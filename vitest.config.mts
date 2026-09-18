import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 使用 .mts 扩展名，让 Node 与 Vite 都以 ESM 方式加载本配置。
// 规则层是纯函数（无网络 / 无 AI / 无 React / 无浏览器 API），
// 因此测试环境用 node，不需要 jsdom；alias 与 tsconfig.json 的 "@/*" 保持一致。
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
