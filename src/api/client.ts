import type {
  ApiErrorBody,
  Candidate,
  ConfigResponse,
  ConfigUpdateRequest,
  Job,
  JobEvent,
  JobItemsResponse,
  PreviewRequest,
  PreviewResponse,
  ReviewItem,
  SubmitJobRequest,
} from './types'

const BASE_KEY = 'flexmediashark.apiBase'

export class ApiRequestError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

let base = (localStorage.getItem(BASE_KEY) ?? '').trim().replace(/\/+$/, '')

export function getApiBase(): string {
  return base
}

export function setApiBase(next: string): void {
  base = next.trim().replace(/\/+$/, '')
  localStorage.setItem(BASE_KEY, base)
}

function withJson(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}${path}`, init)
  } catch {
    throw new ApiRequestError('network_error', '无法连接后端服务，请检查服务地址与网络。', 0)
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = null
    }
    throw new ApiRequestError(
      body?.error ?? `http_${response.status}`,
      body?.message ?? response.statusText ?? '请求失败',
      response.status,
    )
  }

  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

// ---------------------------------------------------------------- 任务

export function submitJob(payload: SubmitJobRequest): Promise<Job> {
  return request<Job>('/scrape/jobs', withJson('POST', payload))
}

export function getJob(id: string): Promise<Job> {
  return request<Job>(`/scrape/jobs/${encodeURIComponent(id)}`)
}

export function getJobItems(id: string, limit: number, offset: number): Promise<JobItemsResponse> {
  return request<JobItemsResponse>(
    `/scrape/jobs/${encodeURIComponent(id)}/items?limit=${limit}&offset=${offset}`,
  )
}

export function cancelJob(id: string): Promise<Job> {
  return request<Job>(`/scrape/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export interface JobEventHandlers {
  onSnapshot?: (job: Job) => void
  onProgress?: (event: JobEvent) => void
  onError?: (error: Error) => void
  onEnd?: () => void
}

/**
 * 订阅任务进度流。服务端在任务进入终态后主动关闭连接，
 * 这里收到终态事件也立刻关闭，避免 EventSource 自动重连造成的空转。
 */
export function subscribeJobEvents(id: string, handlers: JobEventHandlers): () => void {
  const url = `${base}/scrape/jobs/${encodeURIComponent(id)}/events`
  const source = new EventSource(url)
  let closed = false

  const close = (): void => {
    if (closed) return
    closed = true
    source.close()
    handlers.onEnd?.()
  }

  const parse = <T>(raw: string): T | null => {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  source.addEventListener('snapshot', (event) => {
    const job = parse<Job>((event as MessageEvent<string>).data)
    if (job) handlers.onSnapshot?.(job)
  })

  source.addEventListener('progress', (event) => {
    const payload = parse<JobEvent>((event as MessageEvent<string>).data)
    if (!payload) return
    handlers.onProgress?.(payload)
    const terminal =
      payload.status === 'COMPLETED' || payload.status === 'FAILED' || payload.status === 'CANCELLED'
    if (terminal) close()
  })

  source.addEventListener('error', () => {
    if (closed) return
    handlers.onError?.(new Error('进度事件流断开'))
    close()
  })

  return () => {
    closed = true
    source.close()
  }
}

// ---------------------------------------------------------------- 扫描预览

export function previewScan(payload: PreviewRequest): Promise<PreviewResponse> {
  return request<PreviewResponse>('/scan/preview', withJson('POST', payload))
}

// ---------------------------------------------------------------- 复核

export function listAmbiguous(limit: number, offset: number): Promise<ReviewItem[]> {
  return request<ReviewItem[]>(`/review/ambiguous?limit=${limit}&offset=${offset}`)
}

export function getReviewItem(fileId: string): Promise<ReviewItem> {
  return request<ReviewItem>(`/review/${encodeURIComponent(fileId)}`)
}

export function getCandidates(fileId: string): Promise<Candidate[]> {
  return request<Candidate[]>(`/review/${encodeURIComponent(fileId)}/candidates`)
}

export function confirmReviewItem(fileId: string, ref?: string): Promise<ReviewItem> {
  return request<ReviewItem>(
    `/review/${encodeURIComponent(fileId)}/confirm`,
    withJson('POST', ref ? { ref } : {}),
  )
}

export function rejectReviewItem(fileId: string, ref?: string): Promise<ReviewItem> {
  return request<ReviewItem>(
    `/review/${encodeURIComponent(fileId)}/reject`,
    withJson('POST', ref ? { ref } : {}),
  )
}

export function lockFields(fileId: string, fields: Record<string, string>): Promise<ReviewItem> {
  return request<ReviewItem>(
    `/review/${encodeURIComponent(fileId)}/fields`,
    withJson('PATCH', { fields }),
  )
}

// ---------------------------------------------------------------- 配置

export function getConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>('/config')
}

export function updateProvider(id: string, payload: ConfigUpdateRequest): Promise<ConfigResponse> {
  return request<ConfigResponse>(
    `/config/providers/${encodeURIComponent(id)}`,
    withJson('PUT', payload),
  )
}

export function updateParser(id: string, payload: ConfigUpdateRequest): Promise<ConfigResponse> {
  return request<ConfigResponse>(
    `/config/parsers/${encodeURIComponent(id)}`,
    withJson('PUT', payload),
  )
}

export function updateSink(id: string, payload: ConfigUpdateRequest): Promise<ConfigResponse> {
  return request<ConfigResponse>(`/config/sinks/${encodeURIComponent(id)}`, withJson('PUT', payload))
}
