import { ref } from 'vue'
import { ApiRequestError } from '@/api/client'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const toasts = ref<Toast[]>([])
let seq = 0

function remove(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function push(kind: ToastKind, text: string): void {
  const id = ++seq
  toasts.value = [...toasts.value, { id, kind, text }]
  const ttl = kind === 'error' ? 6000 : 3000
  window.setTimeout(() => remove(id), ttl)
}

/** 把任意异常转成一条可读的提示，后端统一错误结构里的 message 直接透出。 */
export function describeError(error: unknown, fallback = '操作失败'): string {
  if (error instanceof ApiRequestError) return `${fallback}：${error.message}`
  if (error instanceof Error) return `${fallback}：${error.message}`
  return fallback
}

export function useToast() {
  return {
    toasts,
    info: (text: string) => push('info', text),
    success: (text: string) => push('success', text),
    error: (text: string) => push('error', text),
    remove,
  }
}
