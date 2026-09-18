import { IMAGE_MAX, TAG_MAX, TITLE_MAX } from "@/lib/rules/constants";

import { ERROR_CODES, type AppErrorCode } from "./codes";
import type { ErrorDescriptor } from "./types";

/**
 * 错误码 → HTTP 状态码 / 可重试标记 / 用户文案 的唯一映射表。
 *
 * 界面只消费 userMessage，日志只记录 code，两者互不污染。
 * 文案中的数量上限一律取自 lib/rules/constants.ts，避免出现第二份硬编码。
 */
export const ERROR_DESCRIPTORS: Record<AppErrorCode, ErrorDescriptor> = {
  [ERROR_CODES.INVALID_INPUT]: {
    httpStatus: 400,
    retryable: false,
    userMessage: "提交的内容不完整或格式不正确，请检查后重试。",
  },
  [ERROR_CODES.NO_IMAGE_UPLOADED]: {
    httpStatus: 400,
    retryable: false,
    userMessage: "请先上传至少 1 张图片。",
  },
  [ERROR_CODES.TOO_MANY_IMAGES]: {
    httpStatus: 400,
    retryable: false,
    userMessage: `一次最多上传 ${IMAGE_MAX} 张图片，请删减后再试。`,
  },
  [ERROR_CODES.UNSUPPORTED_IMAGE_TYPE]: {
    httpStatus: 400,
    retryable: false,
    userMessage: "目前只支持 JPG、PNG、WebP 格式的图片。",
  },
  [ERROR_CODES.IMAGE_TOO_LARGE]: {
    httpStatus: 400,
    retryable: false,
    userMessage: "有图片体积过大，请压缩后重新上传。",
  },
  [ERROR_CODES.AI_UPSTREAM_ERROR]: {
    httpStatus: 502,
    retryable: true,
    userMessage: "AI 服务暂时不可用，请稍后重试。",
  },
  [ERROR_CODES.AI_TIMEOUT]: {
    httpStatus: 504,
    retryable: true,
    userMessage: "AI 响应超时了，请重试这一步。",
  },
  [ERROR_CODES.AI_INVALID_OUTPUT]: {
    httpStatus: 502,
    retryable: true,
    userMessage: "AI 返回的内容格式不正确，请重试这一步。",
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    httpStatus: 503,
    retryable: true,
    userMessage: "网络连接失败，请检查网络后重试。",
  },
  [ERROR_CODES.TITLE_EMPTY]: {
    httpStatus: 400,
    retryable: false,
    userMessage: "标题不能为空，请输入内容。",
  },
  [ERROR_CODES.TITLE_TOO_LONG]: {
    httpStatus: 400,
    retryable: false,
    userMessage: `标题不能超过 ${TITLE_MAX} 个字，请修改后再继续。`,
  },
  [ERROR_CODES.TAGS_TOO_MANY]: {
    httpStatus: 400,
    retryable: false,
    userMessage: `标签最多保留 ${TAG_MAX} 个。`,
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    httpStatus: 500,
    retryable: true,
    userMessage: "服务出现异常，请稍后重试。",
  },
};
