<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  confirmReviewItem,
  getReviewItem,
  listAmbiguous,
  lockFields,
  rejectReviewItem,
} from '@/api/client'
import type { ReviewItem } from '@/api/types'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import { describeError, useToast } from '@/composables/useToast'
import { fileNameOf, formatConfidence, formatTime } from '@/utils/format'

const toast = useToast()

const items = ref<ReviewItem[]>([])
const selectedId = ref<string | null>(null)
const loading = ref(false)
const limit = ref(50)
const offset = ref(0)
const newFieldKey = ref('')
const newFieldValue = ref('')
const savingField = ref(false)
const actingRef = ref<string | null>(null)

const FIELD_SUGGESTIONS = [
  'title',
  'originalTitle',
  'year',
  'overview',
  'genres',
  'season',
  'episode',
  'absoluteEpisode',
  'releaseGroup',
]

const selected = computed(
  () => items.value.find((item) => item.fileId === selectedId.value) ?? null,
)

async function load(offsetValue = offset.value): Promise<void> {
  loading.value = true
  try {
    const page = await listAmbiguous(limit.value, offsetValue)
    items.value = page
    offset.value = offsetValue
    if (!selectedId.value && page.length) selectedId.value = page[0]?.fileId ?? null
    if (selectedId.value && !page.some((item) => item.fileId === selectedId.value)) {
      selectedId.value = page[0]?.fileId ?? null
    }
  } catch (error) {
    toast.error(describeError(error, '加载待复核列表失败'))
  } finally {
    loading.value = false
  }
}

function applyUpdate(updated: ReviewItem): void {
  items.value = items.value.map((item) => (item.fileId === updated.fileId ? updated : item))
  if (updated.status !== 'AMBIGUOUS') {
    items.value = items.value.filter((item) => item.fileId !== updated.fileId)
    selectedId.value = items.value[0]?.fileId ?? null
  }
}

async function onConfirm(ref?: string): Promise<void> {
  if (!selected.value) return
  const fileId = selected.value.fileId
  actingRef.value = ref ?? '__primary__'
  try {
    const updated = await confirmReviewItem(fileId, ref)
    applyUpdate(updated)
    toast.success('已确认该条目，后续重刮不会覆盖此选择。')
  } catch (error) {
    toast.error(describeError(error, '确认失败'))
  } finally {
    actingRef.value = null
  }
}

async function onReject(ref?: string): Promise<void> {
  if (!selected.value) return
  const fileId = selected.value.fileId
  actingRef.value = ref ?? '__primary__'
  try {
    const updated = await rejectReviewItem(fileId, ref)
    applyUpdate(updated)
    toast.success('已拒绝，该候选写入负样本记忆，不会再被自动选中。')
  } catch (error) {
    toast.error(describeError(error, '拒绝失败'))
  } finally {
    actingRef.value = null
  }
}

async function onLockField(): Promise<void> {
  const key = newFieldKey.value.trim()
  const value = newFieldValue.value.trim()
  if (!selected.value || !key || !value) {
    toast.error('请填写要锁定的字段名与值。')
    return
  }
  const fileId = selected.value.fileId
  savingField.value = true
  try {
    const updated = await lockFields(fileId, {
      ...selected.value.lockedFields,
      [key]: value,
    })
    items.value = items.value.map((item) => (item.fileId === fileId ? updated : item))
    newFieldKey.value = ''
    newFieldValue.value = ''
    toast.success('字段已锁定，任何数据源都无法覆盖。')
  } catch (error) {
    toast.error(describeError(error, '锁定字段失败'))
  } finally {
    savingField.value = false
  }
}

async function onUnlockField(key: string): Promise<void> {
  if (!selected.value) return
  const fileId = selected.value.fileId
  const next = { ...selected.value.lockedFields }
  delete next[key]
  try {
    const updated = await lockFields(fileId, next)
    items.value = items.value.map((item) => (item.fileId === fileId ? updated : item))
    toast.info(`已解除锁定：${key}`)
  } catch (error) {
    toast.error(describeError(error, '解除锁定失败'))
  }
}

async function onReload(): Promise<void> {
  await load()
  if (selectedId.value) {
    try {
      const fresh = await getReviewItem(selectedId.value)
      items.value = items.value.map((item) => (item.fileId === fresh.fileId ? fresh : item))
    } catch (error) {
      toast.error(describeError(error, '刷新详情失败'))
    }
  }
}

function kindLabel(kind: string): string {
  return kind === 'MOVIE' ? '电影' : kind === 'SERIES' ? '剧集' : kind === 'EPISODE' ? '单集' : kind
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="review-layout">
    <section class="card list-card">
      <header class="card-head">
        <div>
          <h2 class="card-title">待复核队列</h2>
          <p class="card-sub">未达自动阈值或集号无法推断的条目会停在这里等人判断。</p>
        </div>
        <button class="btn btn-ghost btn-sm" :disabled="loading" @click="onReload">刷新</button>
      </header>

      <EmptyState
        v-if="!items.length && !loading"
        title="队列是空的"
        hint="刮削任务里没能自动确认的条目会出现在这里。"
      />

      <ul v-else class="review-list">
        <li
          v-for="item in items"
          :key="item.fileId"
          class="review-row"
          :class="{ active: item.fileId === selectedId }"
          @click="selectedId = item.fileId"
        >
          <div class="review-row-head">
            <span class="cell-strong ellipsis">{{ fileNameOf(item.path ?? '(未知路径)') }}</span>
            <span class="chip chip-warning" v-if="item.conflicts.length">
              冲突 {{ item.conflicts.length }}
            </span>
          </div>
          <div class="muted small ellipsis">{{ item.path }}</div>
          <div class="review-row-foot">
            <span class="chip">{{ kindLabel(item.mediaKind) }}</span>
            <span class="muted small">置信度 {{ formatConfidence(item.confidence) }}</span>
            <span class="muted small">候选 {{ item.candidates.length }}</span>
          </div>
        </li>
      </ul>

      <div class="pager">
        <button
          class="btn btn-ghost btn-sm"
          :disabled="offset === 0"
          @click="load(Math.max(0, offset - limit))"
        >
          上一页
        </button>
        <span class="muted small">offset {{ offset }}</span>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="items.length < limit"
          @click="load(offset + limit)"
        >
          下一页
        </button>
      </div>
    </section>

    <section class="card detail-card">
      <EmptyState
        v-if="!selected"
        title="选择一个条目"
        hint="从左侧队列里点选一条，这里会展示候选、字段溯源与冲突。"
      />

      <template v-else>
        <header class="card-head">
          <div>
            <h2 class="card-title">
              {{ fileNameOf(selected.path ?? '(未知路径)') }}
              <StatusBadge :status="selected.status" />
            </h2>
            <p class="card-sub ellipsis">{{ selected.path }}</p>
          </div>
          <div class="head-actions">
            <button
              class="btn btn-primary btn-sm"
              :disabled="actingRef !== null"
              @click="onConfirm()"
            >
              确认主条目
            </button>
            <button
              class="btn btn-ghost btn-sm btn-danger"
              :disabled="actingRef !== null"
              @click="onReject()"
            >
              拒绝主条目
            </button>
          </div>
        </header>

        <div class="detail-body">
          <dl class="meta">
            <div>
              <dt>类型</dt>
              <dd>{{ kindLabel(selected.mediaKind) }}</dd>
            </div>
            <div>
              <dt>解析器</dt>
              <dd class="mono">{{ selected.parserId ?? '—' }}</dd>
            </div>
            <div>
              <dt>置信度</dt>
              <dd>{{ formatConfidence(selected.confidence) }}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{{ formatTime(selected.updatedAt) }}</dd>
            </div>
          </dl>

          <div class="block">
            <h3 class="block-title">条目引用</h3>
            <span v-for="ref in selected.refs" :key="ref" class="chip chip-mono">{{ ref }}</span>
            <span v-if="!selected.refs.length" class="muted small">无</span>
          </div>

          <div class="block">
            <h3 class="block-title">
              候选条目
              <span class="muted small">（确认后写入，拒绝则永久屏蔽）</span>
            </h3>
            <EmptyState
              v-if="!selected.candidates.length"
              title="没有候选"
              hint="未达到阈值时可能没有保留候选，可调整数据源配置后重刮。"
            />
            <div v-else class="candidate-grid">
              <article v-for="candidate in selected.candidates" :key="candidate.ref" class="candidate">
                <div class="candidate-head">
                  <img
                    v-if="candidate.posterUrl"
                    class="poster"
                    :src="candidate.posterUrl"
                    :alt="candidate.title"
                    loading="lazy"
                  />
                  <div v-else class="poster poster-empty">无海报</div>
                  <div class="candidate-info">
                    <p class="cell-strong">{{ candidate.title }}</p>
                    <p v-if="candidate.originalTitle" class="muted small ellipsis">
                      {{ candidate.originalTitle }}
                    </p>
                    <p class="muted small">
                      {{ candidate.year ?? '年份未知' }} · {{ kindLabel(candidate.kind) }}
                    </p>
                    <p class="mono small">{{ candidate.ref }}</p>
                  </div>
                </div>
                <p v-if="candidate.overview" class="overview">{{ candidate.overview }}</p>
                <div class="candidate-actions">
                  <button
                    class="btn btn-primary btn-sm"
                    :disabled="actingRef === candidate.ref"
                    @click="onConfirm(candidate.ref)"
                  >
                    确认为此条目
                  </button>
                  <button
                    class="btn btn-ghost btn-sm btn-danger"
                    :disabled="actingRef === candidate.ref"
                    @click="onReject(candidate.ref)"
                  >
                    不是这部
                  </button>
                </div>
              </article>
            </div>
          </div>

          <div class="block">
            <h3 class="block-title">字段锁定</h3>
            <div class="lock-editor">
              <input
                v-model="newFieldKey"
                class="input input-sm"
                list="lockable-fields"
                placeholder="字段名，如 title"
              />
              <datalist id="lockable-fields">
                <option v-for="name in FIELD_SUGGESTIONS" :key="name" :value="name" />
              </datalist>
              <input v-model="newFieldValue" class="input input-sm" placeholder="值" />
              <button class="btn btn-ghost btn-sm" :disabled="savingField" @click="onLockField">
                锁定
              </button>
            </div>
            <div v-if="Object.keys(selected.lockedFields).length" class="lock-list">
              <span
                v-for="(value, key) in selected.lockedFields"
                :key="key"
                class="chip chip-mono"
              >
                {{ key }} = {{ value }}
                <button class="chip-close" :title="`解除 ${key}`" @click="onUnlockField(key)">×</button>
              </span>
            </div>
            <p v-else class="muted small">暂无锁定字段。锁定后重刮不会覆盖这些值。</p>
          </div>

          <div class="block">
            <h3 class="block-title">字段溯源</h3>
            <div v-if="Object.keys(selected.provenance).length" class="kv-grid">
              <div v-for="(source, field) in selected.provenance" :key="field" class="kv">
                <span class="kv-key">{{ field }}</span>
                <span class="kv-value mono">{{ source }}</span>
              </div>
            </div>
            <p v-else class="muted small">暂无溯源信息。</p>
          </div>

          <div class="block">
            <h3 class="block-title">字段冲突</h3>
            <EmptyState v-if="!selected.conflicts.length" title="没有冲突" />
            <div v-else class="conflict-list">
              <article v-for="conflict in selected.conflicts" :key="conflict.field" class="conflict">
                <header>
                  <span class="chip chip-warning">{{ conflict.field }}</span>
                  <span class="muted small">{{ conflict.resolution }}</span>
                </header>
                <ul>
                  <li v-for="entry in conflict.values" :key="`${entry.source}-${entry.value}`">
                    <span>{{ entry.value }}</span>
                    <span class="mono small muted">← {{ entry.source }}</span>
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
