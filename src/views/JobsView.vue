<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { cancelJob, getJob, submitJob } from '@/api/client'
import type { Job } from '@/api/types'
import ProgressBar from '@/components/ProgressBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import { describeError, useToast } from '@/composables/useToast'
import { formatDuration, shortId, spanMs, formatTime } from '@/utils/format'

const emit = defineEmits<{ open: [id: string] }>()

const toast = useToast()
const TRACK_KEY = 'flexmediashark.jobs'
const POLL_MS = 5000

interface TrackedJob {
  id: string
  addedAt: number
}

const jobs = ref<Record<string, Job>>({})
const tracked = ref<TrackedJob[]>(load())
const submitting = ref(false)
const refreshing = ref(false)
const targetMode = ref<'paths' | 'roots'>('paths')
const pathText = ref('')
const force = ref(false)
const dryRun = ref(false)
const lookupId = ref('')

function load(): TrackedJob[] {
  try {
    const raw = localStorage.getItem(TRACK_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is TrackedJob => typeof item === 'object' && item !== null && typeof (item as TrackedJob).id === 'string')
      .slice(0, 60)
  } catch {
    return []
  }
}

function persist(): void {
  localStorage.setItem(TRACK_KEY, JSON.stringify(tracked.value.slice(0, 60)))
}

const ordered = computed(() =>
  tracked.value
    .map((entry) => ({ entry, job: jobs.value[entry.id] }))
    .sort((a, b) => b.entry.addedAt - a.entry.addedAt),
)

const activeCount = computed(
  () =>
    Object.values(jobs.value).filter((job) => job.status === 'PENDING' || job.status === 'RUNNING')
      .length,
)

async function refreshAll(onlyActive = true): Promise<void> {
  // 终态任务不会再变化，轮询时跳过，避免一次刷几十个请求
  const ids = tracked.value
    .map((entry) => entry.id)
    .filter((id) => {
      if (!onlyActive) return true
      const known = jobs.value[id]
      return !known || known.status === 'PENDING' || known.status === 'RUNNING'
    })
  if (!ids.length) return
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await getJob(id)
      } catch {
        return null
      }
    }),
  )
  const next: Record<string, Job> = { ...jobs.value }
  results.forEach((job, index) => {
    const id = ids[index]
    if (job && id) next[id] = job
  })
  jobs.value = next
}

async function onRefresh(): Promise<void> {
  refreshing.value = true
  try {
    await refreshAll(false)
  } finally {
    refreshing.value = false
  }
}

async function onSubmit(): Promise<void> {
  const entries = pathText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!entries.length) {
    toast.error('请至少填写一个路径，留空则使用后端配置里的媒体库根目录。')
    return
  }
  submitting.value = true
  try {
    const job = await submitJob({
      paths: targetMode.value === 'paths' ? entries : [],
      roots: targetMode.value === 'roots' ? entries : [],
      force: force.value,
      dryRun: dryRun.value,
    })
    track(job.id)
    const snapshot: Record<string, Job> = { ...jobs.value }
    snapshot[job.id] = job
    jobs.value = snapshot
    pathText.value = ''
    toast.success(`任务已提交：${shortId(job.id, 12)}`)
    await refreshAll(false)
  } catch (error) {
    toast.error(describeError(error, '任务提交失败'))
  } finally {
    submitting.value = false
  }
}

async function onTrackById(): Promise<void> {
  const id = lookupId.value.trim()
  if (!id) return
  try {
    const job = await getJob(id)
    track(job.id)
    const snapshot: Record<string, Job> = { ...jobs.value }
    snapshot[job.id] = job
    jobs.value = snapshot
    lookupId.value = ''
    toast.success('已加入任务列表')
  } catch (error) {
    toast.error(describeError(error, '查询任务失败'))
  }
}

function track(id: string): void {
  if (tracked.value.some((entry) => entry.id === id)) return
  tracked.value = [{ id, addedAt: Date.now() }, ...tracked.value]
  persist()
}

async function onCancel(id: string): Promise<void> {
  try {
    const job = await cancelJob(id)
    const snapshot: Record<string, Job> = { ...jobs.value }
    snapshot[job.id] = job
    jobs.value = snapshot
    toast.info('已请求取消，worker 会在当前文件处理完后停止。')
  } catch (error) {
    toast.error(describeError(error, '取消失败'))
  }
}

function onRemove(id: string): void {
  tracked.value = tracked.value.filter((entry) => entry.id !== id)
  const snapshot: Record<string, Job> = { ...jobs.value }
  delete snapshot[id]
  jobs.value = snapshot
  persist()
}

let timer: number | undefined
onMounted(() => {
  void refreshAll()
  timer = window.setInterval(() => {
    if (activeCount.value > 0) void refreshAll()
  }, POLL_MS)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="stack">
    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">发起刮削任务</h2>
          <p class="card-sub">
            提交后返回任务编号，服务以异步任务处理；可随时取消，重启后未完成任务继续。
          </p>
        </div>
      </header>

      <div class="form-grid">
        <div class="field">
          <label class="label">目标类型</label>
          <div class="segmented">
            <button
              type="button"
              class="segment"
              :class="{ active: targetMode === 'paths' }"
              @click="targetMode = 'paths'"
            >
              具体路径
            </button>
            <button
              type="button"
              class="segment"
              :class="{ active: targetMode === 'roots' }"
              @click="targetMode = 'roots'"
            >
              媒体库根目录
            </button>
          </div>
        </div>

        <div class="field full">
          <label class="label">
            {{ targetMode === 'paths' ? '文件或目录的绝对路径（每行一个）' : '媒体库根目录（每行一个）' }}
          </label>
          <textarea
            v-model="pathText"
            class="textarea"
            rows="4"
            placeholder="/media/movies&#10;/media/tv/某剧/Season 01"
          />
        </div>

        <div class="field">
          <label class="label">选项</label>
          <div class="checks">
            <label class="check">
              <input v-model="force" type="checkbox" />
              <span>强制重刮（忽略指纹）</span>
            </label>
            <label class="check">
              <input v-model="dryRun" type="checkbox" />
              <span>试运行（只算不写）</span>
            </label>
          </div>
        </div>

        <div class="field actions">
          <button class="btn btn-primary" :disabled="submitting" @click="onSubmit">
            {{ submitting ? '提交中…' : '提交任务' }}
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">
            任务列表
            <span class="muted small">（后端按 ID 查询，这里保存本机提交过的任务）</span>
          </h2>
        </div>
        <div class="head-actions">
          <input
            v-model="lookupId"
            class="input input-sm"
            placeholder="按任务 ID 追查"
            @keyup.enter="onTrackById"
          />
          <button class="btn btn-ghost btn-sm" @click="onTrackById">追查</button>
          <button class="btn btn-ghost btn-sm" :disabled="refreshing" @click="onRefresh">
            {{ refreshing ? '刷新中…' : '刷新' }}
          </button>
        </div>
      </header>

      <EmptyState
        v-if="!ordered.length"
        title="还没有任务"
        hint="提交一个刮削任务，或粘贴已有的任务 ID 追查进度。"
      />

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 130px">任务</th>
              <th style="width: 96px">状态</th>
              <th style="width: 200px">进度</th>
              <th>结果分布</th>
              <th style="width: 170px">创建时间</th>
              <th style="width: 120px">耗时</th>
              <th style="width: 180px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ordered" :key="row.entry.id">
              <td><span class="mono">{{ shortId(row.entry.id, 10) }}</span></td>
              <td>
                <StatusBadge v-if="row.job" :status="row.job.status" />
                <span v-else class="muted small">未获取</span>
              </td>
              <td>
                <template v-if="row.job">
                  <ProgressBar :value="row.job.processed" :total="row.job.total" />
                  <span class="muted small">
                    {{ row.job.processed }} / {{ row.job.total }}
                  </span>
                </template>
                <span v-else class="muted small">—</span>
              </td>
              <td>
                <template v-if="row.job">
                  <span class="chip chip-success">成功 {{ row.job.succeeded }}</span>
                  <span class="chip chip-warning">待复核 {{ row.job.ambiguous }}</span>
                  <span class="chip">跳过 {{ row.job.skipped }}</span>
                  <span class="chip chip-danger">失败 {{ row.job.failed }}</span>
                </template>
                <span v-else class="muted small">—</span>
              </td>
              <td class="muted small">
                {{ row.job ? formatTime(row.job.createdAt) : '—' }}
              </td>
              <td class="muted small">
                {{ row.job ? formatDuration(spanMs(row.job.startedAt, row.job.finishedAt)) : '—' }}
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" @click="emit('open', row.entry.id)">详情</button>
                  <button
                    v-if="row.job && (row.job.status === 'PENDING' || row.job.status === 'RUNNING')"
                    class="btn btn-ghost btn-sm"
                    @click="onCancel(row.entry.id)"
                  >
                    取消
                  </button>
                  <button class="btn btn-ghost btn-sm btn-danger" @click="onRemove(row.entry.id)">
                    移除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
