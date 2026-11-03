const UNKNOWN = '—'

export function formatTime(ms: number | null | undefined): string {
  if (!ms) return UNKNOWN
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return UNKNOWN
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatClock(ms: number | null | undefined): string {
  if (!ms) return UNKNOWN
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return UNKNOWN
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return UNKNOWN
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes} 分 ${rest} 秒`
}

export function spanMs(start: number | null | undefined, end: number | null | undefined): number | null {
  if (!start || !end) return null
  return Math.max(0, end - start)
}

export function percent(value: number, total: number): number {
  if (!total) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}

export function shortId(id: string, size = 8): string {
  if (id.length <= size) return id
  return id.slice(0, size)
}

export function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

export function parentOf(path: string): string {
  const parts = path.split(/[\\/]/)
  parts.pop()
  return parts.join('/')
}

export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN
  return value.toFixed(2)
}
