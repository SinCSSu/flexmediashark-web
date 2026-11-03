export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type JobItemStatus = 'SUCCESS' | 'SKIPPED' | 'AMBIGUOUS' | 'FAILED'
export type MatchStatus = 'AUTO' | 'AMBIGUOUS' | 'CONFIRMED' | 'REJECTED' | 'FAILED'
export type MediaKind = 'MOVIE' | 'SERIES' | 'EPISODE'
export type NumberingScheme = 'PROVIDER_NATIVE' | 'ABSOLUTE'

export interface Job {
  id: string
  status: JobStatus
  total: number
  processed: number
  succeeded: number
  skipped: number
  failed: number
  ambiguous: number
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
  cancelRequested: boolean
}

export interface JobItem {
  id: string
  fileId: string
  path: string
  status: JobItemStatus
  message: string | null
  parserId: string | null
  providerId: string | null
  refs: string[]
  durationMs: number
}

export interface JobItemsResponse {
  jobId: string
  items: JobItem[]
  limit: number
  offset: number
}

export interface JobEvent {
  jobId: string
  status: JobStatus
  processed: number
  total: number
  succeeded: number
  skipped: number
  failed: number
  ambiguous: number
  message?: string | null
}

export interface SubmitJobRequest {
  paths: string[]
  roots: string[]
  force: boolean
  dryRun: boolean
}

export interface PreviewRequest {
  paths: string[]
  roots: string[]
  limit: number
}

export interface PreviewFile {
  path: string
  mediaKind: MediaKind
  parserId: string | null
  title: string | null
  year: number | null
  season: number | null
  episode: number | null
  absoluteEpisode: number | null
  episodeRange: string | null
  confidence: number | null
  parsersExecuted: string[]
  parserErrors: string[]
}

export interface PreviewResponse {
  totalFiles: number
  returned: number
  files: PreviewFile[]
}

export interface ConflictValue {
  value: string
  source: string
}

export interface MergeConflict {
  field: string
  values: ConflictValue[]
  resolution: string
}

export interface Candidate {
  ref: string
  title: string
  originalTitle: string | null
  year: number | null
  kind: string
  overview: string | null
  posterUrl: string | null
}

export interface ReviewItem {
  fileId: string
  path: string | null
  mediaKind: MediaKind
  status: MatchStatus
  primaryRef: string | null
  refs: string[]
  confidence: number
  parserId: string | null
  lockedFields: Record<string, string>
  provenance: Record<string, string>
  conflicts: MergeConflict[]
  candidates: Candidate[]
  updatedAt: number
}

export interface ProviderView {
  id: string
  displayName: string
  enabled: boolean
  priority: number
  mediaKinds: string[]
  languages: string[]
  supportsLookupByExternalRef: boolean
  configuredKeys: string[]
}

export interface ParserView {
  id: string
  displayName: string
  enabled: boolean
  order: number
  configuredKeys: string[]
}

export interface SinkView {
  id: string
  displayName: string
  enabled: boolean
  priority: number
  configuredKeys: string[]
}

export interface ConfigResponse {
  providers: ProviderView[]
  parsers: ParserView[]
  sinks: SinkView[]
  autoThreshold: number
  numberingScheme: NumberingScheme
  language: string
  snapshotFingerprint: string
}

export interface ConfigUpdateRequest {
  enabled?: boolean
  priority?: number
  order?: number
  settings?: Record<string, string>
}

export interface ApiErrorBody {
  error: string
  message?: string | null
}
