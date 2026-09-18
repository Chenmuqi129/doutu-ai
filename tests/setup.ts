import { beforeEach, vi } from "vitest";

// 最小 localStorage 实现：让 zustand persist 在 node 测试环境下可用，
// 同时让测试可以断言「到底把什么写进了本地存储」。
function createMemoryStorage() {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

const memoryStorage = createMemoryStorage();

vi.stubGlobal("localStorage", memoryStorage);

beforeEach(() => {
  memoryStorage.clear();
});
