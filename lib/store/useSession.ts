"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { clearUploadBlobs, releaseUploadBlob } from "@/lib/image/uploadRegistry";
import type {
  MaterialAnalysisResult,
  SessionImage,
  SessionState,
  SessionStep,
  StaleFlags,
} from "@/lib/types";

// 会话状态（P2）。
// 结构完全建立在 P0 已确认的 SessionState 之上，没有另起一套：
// SessionState = PersistedSessionState（可持久化文本）+ images（仅内存）。
// 额外只增加两个瞬时字段 analyzeStatus / analyzeError，它们不写入 localStorage。

export type AnalyzeStatus = "idle" | "loading" | "error";

export type SessionStoreState = SessionState & {
  analyzeStatus: AnalyzeStatus;
  analyzeError?: string;
};

export type SessionActions = {
  addImages: (images: SessionImage[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  applyAnalysis: (result: MaterialAnalysisResult) => void;
  selectTopic: (topicId: string) => void;
  setAnalyzeStatus: (status: AnalyzeStatus, error?: string) => void;
  resetSession: () => void;
};

export type SessionStore = SessionStoreState & SessionActions;

export const SESSION_STORAGE_KEY = "doutu-ai:session";

export const INITIAL_SESSION_STATE: SessionStoreState = {
  images: [],
  step: "upload",
  stale: { titles: false, draft: false },
  analyzeStatus: "idle",
};

/* ---------------- Stale Matrix（架构差异报告 M12） ---------------- */

// 只有确实存在过下游产物时才标记过期，
// 避免用户刚选完选题就看到「内容已过期」的误报。
function buildStaleFlags(state: SessionStoreState): StaleFlags {
  const hadTitles = Boolean(state.titles && state.titles.length > 0);
  const hadSelectedTitle =
    typeof state.selectedTitle === "string" && state.selectedTitle.length > 0;
  const hadDraft = Boolean(state.draft);

  return { titles: hadTitles || hadSelectedTitle, draft: hadDraft };
}

// 图片集合变化：分析与全部下游产物作废，回到上传步骤。
function invalidateForImageChange(state: SessionStoreState) {
  return {
    analysis: undefined,
    topics: undefined,
    brief: undefined,
    selectedTopicId: undefined,
    titles: undefined,
    selectedTitle: undefined,
    draft: undefined,
    stale: buildStaleFlags(state),
    step: "upload" as SessionStep,
    analyzeStatus: "idle" as AnalyzeStatus,
    analyzeError: undefined,
  };
}

// 更换选题：只作废标题与下游，analysis / topics / brief 全部保留。
function invalidateForTopicChange(state: SessionStoreState) {
  return {
    titles: undefined,
    selectedTitle: undefined,
    draft: undefined,
    stale: buildStaleFlags(state),
  };
}

/* ---------------- 浏览器能力与资源清理 ---------------- */

function revokeObjectUrl(objectUrl: string): void {
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(objectUrl);
  }
}

const memoryNoopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// SSR / Node 环境没有 localStorage 时退化为空实现，避免 persist 抛错。
function resolveStorage(): StateStorage {
  const candidate = (globalThis as { localStorage?: StateStorage }).localStorage;
  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  ) {
    return candidate;
  }
  return memoryNoopStorage;
}

/* ---------------- Store ---------------- */

export const useSession = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_SESSION_STATE,

      addImages: (images) => {
        if (images.length === 0) {
          return;
        }
        set((state) => ({
          ...invalidateForImageChange(state),
          images: [...state.images, ...images],
        }));
      },

      removeImage: (id) => {
        const target = get().images.find((image) => image.id === id);
        if (!target) {
          return;
        }
        revokeObjectUrl(target.objectUrl);
        releaseUploadBlob(id);
        set((state) => ({
          ...invalidateForImageChange(state),
          images: state.images.filter((image) => image.id !== id),
        }));
      },

      clearImages: () => {
        for (const image of get().images) {
          revokeObjectUrl(image.objectUrl);
        }
        clearUploadBlobs();
        set((state) => ({ ...invalidateForImageChange(state), images: [] }));
      },

      applyAnalysis: (result) => {
        set({
          analysis: result.analysis,
          topics: result.topics,
          brief: result.brief,
          selectedTopicId: undefined,
          titles: undefined,
          selectedTitle: undefined,
          draft: undefined,
          stale: { titles: false, draft: false },
          step: "topics",
          analyzeStatus: "idle",
          analyzeError: undefined,
        });
      },

      selectTopic: (topicId) => {
        set((state) => {
          const exists = state.topics?.some((topic) => topic.id === topicId) ?? false;
          if (!exists) {
            return {};
          }
          return { ...invalidateForTopicChange(state), selectedTopicId: topicId };
        });
      },

      setAnalyzeStatus: (status, error) => {
        set({ analyzeStatus: status, analyzeError: error });
      },

      resetSession: () => {
        for (const image of get().images) {
          revokeObjectUrl(image.objectUrl);
        }
        clearUploadBlobs();
        // set 是浅合并，可选字段必须显式置为 undefined 才会真正被清空
        set({
          ...INITIAL_SESSION_STATE,
          images: [],
          stale: { titles: false, draft: false },
          analysis: undefined,
          topics: undefined,
          brief: undefined,
          selectedTopicId: undefined,
          titles: undefined,
          selectedTitle: undefined,
          draft: undefined,
          analyzeError: undefined,
        });
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(resolveStorage),
      // 由客户端在挂载后主动 rehydrate：这样可以保证首屏（SSR 与首次水合）
      // 渲染的是同一份初始状态，不会出现 hydration mismatch。
      skipHydration: true,
      // 只持久化文本状态：images 与 analyzeStatus / analyzeError 写不进 localStorage（M14）。
      partialize: (state) => ({
        analysis: state.analysis,
        topics: state.topics,
        brief: state.brief,
        selectedTopicId: state.selectedTopicId,
        titles: state.titles,
        selectedTitle: state.selectedTitle,
        draft: state.draft,
        step: state.step,
        stale: state.stale,
      }),
    },
  ),
);
