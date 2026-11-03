<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { cancelJob, getJob, getJobItems, subscribeJobEvents } from '@/api/client'
import type { Job, JobEvent, JobItem, JobItemStatus } from '@/api/types'
import ProgressBar from '@/components/ProgressBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import { describeError, useToast } from '@/composables/useToast'
import { formatDuration, fileNameOf, formatTime, parentOf, spanMs } from '@/utils/format'

const props = defineProps<{ jobId: string }>()
const emit = defineEmits<{ back: [] }>()

const toast = useToast()
const POLL_MS = 5000

const job = ref<Job | null>(null)
const items = ref<JobItem[]>([])
const loading = ref(false)
const itemsLoading = ref(false)
const sseOn = ref(true)
const sseState = ref<'idle' | 'live' | 'closed'>('idle')
const limit = ref(100)
const offset = ref(0)
const nextOffset = ref<number | null>(null)
const statusFilter = ref<'ALL' | JobItemStatus>('ALL')

let unsubscribe: (() => void) | null = null

const progressValue = computed(() => job.value?.processed ?? 0)
const progressTotal = computed(() => job.value?.total ?? 0)
const isActive = computed(
  () => job.value?.status === 'PENDING' || job.value?.status === 'RUNNING',
)

const counters = computed(() =>
  job.value
    ? [
        { label: '已处理', value: job.value.processed, tone: 'accent' },
        { label: '成功', value: job.value.succeeded, tone: 'success' },
        { label: '待复核', value: job.value.ambiguous, tone: 'warning' },
        { label: '跳过', value: job.value.skipped, tone: 'neutral' },
        { label: '失败', value: job.value.failed, tone: 'danger' },
      ]
    : [],
)

const filteredItems = computed(() =>
  statusFilter.value === 'ALL'
    ? items.value
    : items.value.filter((item) => item.status === statusFilter.value),
)

async function loadJob(): Promise<void> {
  loading.value = true
  try {
    job.value = await getJob(props.jobId)
  } catch (error) {
    toast.error(describeError(error, '加载任务失败'))
  } finally {
    loading.value = false
  }
}

async function loadItems(): Promise<void> {
  itemsLoading.value = true
  try {
    const page = await getJobItems(props.jobId, limit.value, offset.value)
    items.value = page.items
    nextOffset.value = page.items.length === limit.value ? page.offset + page.items.length : null
  } catch (error) {
    toast.error(describeError(error, '加载明细失败'))
  } finally {
    itemsLoading.value = false
  }
}

function connectStream(): void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  unsubscribe = subscribeJobEvents(props.jobId, {
    onSnapshot: (snapshot) => {
      job.value = snapshot
      sseState.value = 'live'
    },
    onProgress: (event: JobEvent) => {
      const current = job.value
      if (current) {
        job.value = {
          ...current,
          status: event.status,
          processed: event.processed,
          total: event.total || current.total,
          succeeded: event.succeeded,
          skipped: event.skipped,
          failed: event.failed,
          ambiguous: event.ambiguous,
        }
      }
      sseState.value = 'live'
    },
    onError: () => {
      sseState.value = 'closed'
    },
    onEnd: () => {
      sseState.value = 'closed'
    },
  })
}

function disconnectStream(): void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  sseState.value = 'idle'
}

async function onToggleStream(): Promise<void> {
  if (sseOn.value) {
    disconnectStream()
    sseOn.value = false
    return
  }
  sseOn.value = true
  await loadJob()
  if (isActive.value) connectStream()
}

async function onCancel(): Promise<void> {
  try {
    job.value = await cancelJob(props.jobId)
    toast.info('已请求取消')
  } catch (error) {
    toast.error(describeError(error, '取消失败'))
  }
}

function changePage(next: number): void {
  offset.value = Math.max(0, next)
  void loadItems()
}

function reload(): void {
  void loadJob()
  void loadItems()
}

watch(limit, () => {
  offset.value = 0
  void loadItems()
})

// 任务进入终态时补一次明细，保证最后一批文件结果也被拉到
watch(
  () => job.value?.status,
  (status, previous) => {
    if (!previous || !status || previous === status) return
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') void loadItems()
  },
)

let timer: number | undefined
onMounted(async () => {
  await loadJob()
  await loadItems()
  if (isActive.value) connectStream()
  // SSE 被代理掐断时仍有兜底轮询，避免进度卡死在旧数字上
  timer = window.setInterval(() => {
    if (isActive.value && sseState.value !== 'live') void loadJob()
  }, POLL_MS)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
  disconnectStream()
})
</script>

<template>
  <div class="stack">
    <section class="card">
      <header class="card-head">
        <div>
          <button class="btn btn-ghost btn-sm" @click="emit('back')">← 返回任务列表</button>
          <h2 class="card-title inline-title">
            任务 <span class="mono">{{ jobId }}</span>
            <StatusBadge v-if="job" :status="job.status" />
          </h2>
          <p class="card-sub">
            <span v-if="job">提交于 {{ formatTime(job.createdAt) }}</span>
            <span v-else>加载中…</span>
          </p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" :disabled="loading" @click="reload">刷新</button>
          <button
            class="btn btn-ghost btn-sm"
            :class="{ active: sseOn }"
            @click="onToggleStream"
          >
            实时流 {{ sseState === 'live' ? '已连接' : sseState === 'closed' ? '已断开' : '待连接' }}
          </button>
          <button
            v-if="isActive"
            class="btn btn-danger btn-sm"
            @click="onCancel"
          >
            取消任务
          </button>
        </div>
      </header>

      <div v-if="job" class="detail-body">
        <div class="progress-row">
          <ProgressBar :value="progressValue" :total="progressTotal" :height="10" />
          <span class="muted small">{{ progressValue }} / {{ progressTotal }}</span>
        </div>

        <div class="stat-grid">
          <div v-for="counter in counters" :key="counter.label" class="stat">
            <span class="stat-label">{{ counter.label }}</span>
            <span class="stat-value" :class="`stat-${counter.tone}`">{{ counter.value }}</span>
          </div>
        </div>

        <dl class="meta">
          <div>
            <dt>开始</dt>
            <dd>{{ formatTime(job.startedAt) }}</dd>
          </div>
          <div>
            <dt>结束</dt>
            <dd>{{ formatTime(job.finishedAt) }}</dd>
          </div>
          <div>
            <dt>耗时</dt>
            <dd>{{ formatDuration(spanMs(job.startedAt, job.finishedAt)) }}</dd>
          </div>
          <div>
            <dt>取消请求</dt>
            <dd>{{ job.cancelRequested ? '是' : '否' }}</dd>
          </div>
        </dl>

        <p v-if="job.error" class="alert alert-danger">任务错误：{{ job.error }}</p>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">逐文件结果</h2>
          <p class="card-sub">记录命中的解析器、来源与条目引用，便于定位识别问题。</p>
        </div>
        <div class="head-actions">
          <div class="segmented">
            <button
              v-for="option in (['ALL', 'SUCCESS', 'AMBIGUOUS', 'SKIPPED', 'FAILED'] as const)"
              :key="option"
              type="button"
              class="segment segment-sm"
              :class="{ active: statusFilter === option }"
              @click="statusFilter = option"
            >
              {{
                option === 'ALL'
                  ? '全部'
                  : option === 'SUCCESS'
                    ? '成功'
                    : option === 'AMBIGUOUS'
                      ? '待复核'
                      : option === 'SKIPPED'
                        ? '跳过'
                        : '失败'
              }}
            </button>
          </div>
          <select v-model.number="limit" class="select select-sm">
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
            <option :value="200">200 条/页</option>
          </select>
        </div>
      </header>

      <EmptyState
        v-if="!filteredItems.length && !itemsLoading"
        title="暂无明细"
        hint="任务开始处理后，逐文件结果会实时汇总到这里。"
      />

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>文件</th>
              <th style="width: 100px">状态</th>
              <th style="width: 130px">解析器</th>
              <th style="width: 110px">数据源</th>
              <th style="width: 200px">条目引用</th>
              <th style="width: 90px">耗时</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id">
              <td>
                <div class="cell-strong">{{ fileNameOf(item.path) }}</div>
                <div class="muted small ellipsis" :title="item.path">{{ parentOf(item.path) }}</div>
                <div v-if="item.message" class="muted small">{{ item.message }}</div>
              </td>
              <td><StatusBadge :status="item.status" /></td>
              <td class="mono small">{{ item.parserId ?? '—' }}</td>
              <td class="mono small">{{ item.providerId ?? '—' }}</td>
              <td>
                <span v-for="ref in item.refs" :key="ref" class="chip chip-mono">{{ ref }}</span>
                <span v-if="!item.refs.length" class="muted small">—</span>
              </td>
              <td class="muted small">{{ formatDuration(item.durationMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="changePage(offset - limit)">
          上一页
        </button>
        <span class="muted small">offset {{ offset }}</span>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="nextOffset === null"
          @click="changePage(nextOffset ?? offset)"
        >
          下一页
        </button>
        <span v-if="itemsLoading" class="muted small">加载中…</span>
      </div>
    </section>
  </div>
</template>
