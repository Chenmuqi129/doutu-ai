"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatImageCounter,
  hasCarouselControls,
  normalizeImageIndex,
  stepImageIndex,
  toAspectRatio,
} from "@/lib/preview/carousel";
import type { SessionImage } from "@/lib/types";

// 图片轮播（P3-C）：直接复用上传阶段已经存在的图片对象（内存 ObjectURL），
// 不重新上传、不重新编码、不转 base64，顺序与用户上传顺序完全一致。
//
// 比例：容器不写死 3:4 / 4:3，而是按「当前这张图」自己的宽高动态设置 aspect-ratio，
// 图片用 object-fit: contain 完整显示；多图各用各的比例，切换后容器高度随之变化。
export function ImageCarousel({ images }: { images: SessionImage[] }) {
  const [index, setIndex] = useState(0);
  // 元数据不可用时的兜底：用图片自身的 naturalWidth / naturalHeight 反推比例
  const [naturalRatios, setNaturalRatios] = useState<Record<string, number>>({});

  if (images.length === 0) {
    return null;
  }

  const current = normalizeImageIndex(index, images.length);
  const image = images[current];
  const showControls = hasCarouselControls(images.length);

  // 每张图片有自己的比例：切换图片后这里的值随之变化
  const metaRatio = toAspectRatio(image.width, image.height);
  const ratio = metaRatio ?? naturalRatios[image.id];

  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-hidden rounded-xl border bg-muted"
        style={ratio !== undefined ? { aspectRatio: ratio } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 本地 ObjectURL 预览，next/image 不适用 */}
        <img
          src={image.objectUrl}
          alt={image.fileName}
          className={
            ratio !== undefined
              ? "h-full w-full object-contain"
              : "block h-auto w-full"
          }
          onLoad={(event) => {
            if (metaRatio !== undefined) {
              return;
            }
            const fallback = toAspectRatio(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            );
            if (fallback === undefined) {
              return;
            }
            setNaturalRatios((prev) =>
              prev[image.id] === fallback ? prev : { ...prev, [image.id]: fallback },
            );
          }}
        />
      </div>

      {showControls ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex(stepImageIndex(current, -1, images.length))}
          >
            上一张
          </Button>
          <span className="text-xs text-muted-foreground">
            {formatImageCounter(current, images.length)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex(stepImageIndex(current, 1, images.length))}
          >
            下一张
          </Button>
        </div>
      ) : null}
    </div>
  );
}
