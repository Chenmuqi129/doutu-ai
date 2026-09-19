"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatImageCounter,
  hasCarouselControls,
  normalizeImageIndex,
  stepImageIndex,
} from "@/lib/preview/carousel";
import type { SessionImage } from "@/lib/types";

// 图片轮播（P3-C）：直接复用上传阶段已经存在的图片对象（内存 ObjectURL），
// 不重新上传、不重新编码、不转 base64，顺序与用户上传顺序完全一致。
export function ImageCarousel({ images }: { images: SessionImage[] }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const current = normalizeImageIndex(index, images.length);
  const image = images[current];
  const showControls = hasCarouselControls(images.length);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- 本地 ObjectURL 预览，next/image 不适用 */}
        <img
          src={image.objectUrl}
          alt={image.fileName}
          className="aspect-[4/5] w-full object-cover"
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
