"use client";

import { useRef, useState } from "react";

import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { compressImage, isAcceptedImageType } from "@/lib/image/compress";
import { registerUploadBlob } from "@/lib/image/uploadRegistry";
import { IMAGE_ACCEPTED_EXTENSIONS, IMAGE_MAX, IMAGE_MIN } from "@/lib/rules/constants";
import { useSession } from "@/lib/store/useSession";
import type { SessionImage } from "@/lib/types";

import { useAnalyze } from "./useAnalyze";

// 上传步骤（P2）：选择图片 → 客户端压缩 → 缩略图预览 → 删除 → 开始分析。
// 图片只保存在内存（Blob + ObjectURL），永远不会进入 localStorage。
export function UploadStep() {
  const inputRef = useRef<HTMLInputElement>(null);
  const images = useSession((state) => state.images);
  const addImages = useSession((state) => state.addImages);
  const removeImage = useSession((state) => state.removeImage);
  const analyzeStatus = useSession((state) => state.analyzeStatus);
  const analyzeError = useSession((state) => state.analyzeError);

  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const { runAnalyze } = useAnalyze();

  const remainingSlots = IMAGE_MAX - images.length;
  const isAnalyzing = analyzeStatus === "loading";
  const canAnalyze = images.length >= IMAGE_MIN && !isAnalyzing && !processing;

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) {
      return;
    }

    setLocalError(undefined);

    if (images.length + files.length > IMAGE_MAX) {
      setLocalError(
        `一次最多上传 ${IMAGE_MAX} 张图片，当前还能添加 ${remainingSlots} 张。`,
      );
      return;
    }

    setProcessing(true);
    const accepted: SessionImage[] = [];
    const failures: string[] = [];

    for (const file of files) {
      try {
        if (!isAcceptedImageType(file.type)) {
          failures.push(`${file.name}：格式不支持`);
          continue;
        }

        const compressed = await compressImage(file);
        const id = createImageId();

        registerUploadBlob(id, compressed.blob);
        accepted.push({
          id,
          objectUrl: URL.createObjectURL(compressed.blob),
          fileName: file.name,
          mimeType: compressed.mimeType,
          sizeBytes: compressed.sizeBytes,
          width: compressed.width,
          height: compressed.height,
        });
      } catch (error) {
        failures.push(`${file.name}：${isAppError(error) ? error.userMessage : "处理失败"}`);
      }
    }

    if (accepted.length > 0) {
      addImages(accepted);
    }
    if (failures.length > 0) {
      setLocalError(failures.join("；"));
    }

    setProcessing(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">1. 上传素材</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            支持 JPG / PNG / WebP，{IMAGE_MIN}～{IMAGE_MAX} 张，图片只保存在本机内存中。
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {images.length} / {IMAGE_MAX}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={remainingSlots <= 0 || processing}
        >
          {processing ? "正在压缩…" : "选择图片"}
        </Button>
        <Button type="button" onClick={() => void runAnalyze()} disabled={!canAnalyze}>
          {isAnalyzing ? "AI 正在分析素材…" : "开始分析"}
        </Button>
      </div>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 ObjectURL 预览，next/image 不适用 */}
              <img
                src={image.objectUrl}
                alt={image.fileName}
                className="h-28 w-full bg-muted object-cover"
              />
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-xs text-muted-foreground">
                  {image.width}×{image.height}
                </span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeImage(image.id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {localError ? <ErrorBanner message={localError} /> : null}
      {analyzeError ? <ErrorBanner message={analyzeError} /> : null}
    </section>
  );
}

function createImageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
