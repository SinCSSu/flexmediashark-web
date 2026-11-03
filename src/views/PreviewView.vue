<script setup lang="ts">
import { ref } from 'vue'
import { previewScan } from '@/api/client'
import type { PreviewFile, PreviewResponse } from '@/api/types'
import EmptyState from '@/components/EmptyState.vue'
import { describeError, useToast } from '@/composables/useToast'
import { fileNameOf, formatConfidence, parentOf } from '@/utils/format'

const toast = useToast()

const targetMode = ref<'paths' | 'roots'>('paths')
const pathText = ref('')
const limit = ref(200)
const result = ref<PreviewResponse | null>(null)
const loading = ref(false)

async function onPreview(): Promise<void> {
  const entries = pathText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  loading.value = true
  try {
    result.value = await previewScan({
      paths: targetMode.value === 'paths' ? entries : [],
      roots: targetMode.value === 'roots' ? entries : [],
      limit: limit.value,
    })
  } catch (error) {
    toast.error(describeError(error, '扫描预览失败'))
  } finally {
    loading.value = false
  }
}

function confidenceClass(file: PreviewFile): string {
  if (file.confidence === null) return 'fill-neutral'
  if (file.confidence >= 0.85) return 'fill-success'
  if (file.confidence >= 0.6) return 'fill-warning'
  return 'fill-danger'
}

function kindLabel(kind: string): string {
  return kind === 'MOVIE' ? '电影' : kind === 'SERIES' ? '剧集' : kind === 'EPISODE' ? '单集' : kind
}
</script>

<template>
  <div class="stack">
    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">文件名识别预览</h2>
          <p class="card-sub">
            只扫描与解析、不刮削也不写盘。用来先确认命名解析器把文件识别成了什么，再决定是否开刮。
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

        <div class="field">
          <label class="label">返回条数上限</label>
          <input v-model.number="limit" class="input" type="number" min="1" max="2000" />
        </div>

        <div class="field full">
          <label class="label">
            路径（每行一个，留空则使用后端配置里的媒体库根目录）
          </label>
          <textarea
            v-model="pathText"
            class="textarea"
            rows="4"
            placeholder="/media/tv/某剧/Season 01"
          />
        </div>

        <div class="field actions">
          <button class="btn btn-primary" :disabled="loading" @click="onPreview">
            {{ loading ? '扫描中…' : '扫描预览' }}
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">识别结果</h2>
          <p class="card-sub" v-if="result">
            共扫描 {{ result.totalFiles }} 个文件，返回 {{ result.returned }} 条
          </p>
          <p class="card-sub" v-else>执行一次扫描预览即可看到解析结果。</p>
        </div>
      </header>

      <EmptyState
        v-if="!result"
        title="暂无预览结果"
        hint="填入路径后点击「扫描预览」，结果会显示每个文件命中的解析器与置信度。"
      />

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>文件</th>
              <th style="width: 80px">类型</th>
              <th style="width: 200px">识别结果</th>
              <th style="width: 160px">季 / 集</th>
              <th style="width: 150px">置信度</th>
              <th style="width: 150px">命中解析器</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in result.files" :key="file.path">
              <td>
                <div class="cell-strong">{{ fileNameOf(file.path) }}</div>
                <div class="muted small ellipsis" :title="file.path">{{ parentOf(file.path) }}</div>
              </td>
              <td><span class="chip">{{ kindLabel(file.mediaKind) }}</span></td>
              <td>
                <div v-if="file.title" class="cell-strong">{{ file.title }}</div>
                <div v-else class="muted small">未识别</div>
                <div class="muted small">
                  <span v-if="file.year">{{ file.year }}</span>
                  <span v-if="file.episodeRange">区间 {{ file.episodeRange }}</span>
                </div>
              </td>
              <td class="mono small">
                <template v-if="file.season || file.episode">
                  S{{ String(file.season ?? 0).padStart(2, '0') }}E{{ String(file.episode ?? 0).padStart(2, '0') }}
                </template>
                <span v-else class="muted">—</span>
                <div v-if="file.absoluteEpisode" class="muted small">
                  绝对集号 {{ file.absoluteEpisode }}
                </div>
              </td>
              <td>
                <div class="progress" style="height: 6px">
                  <div
                    class="progress-fill"
                    :class="confidenceClass(file)"
                    :style="{ width: `${Math.round((file.confidence ?? 0) * 100)}%` }"
                  />
                </div>
                <span class="muted small">{{ formatConfidence(file.confidence) }}</span>
              </td>
              <td>
                <span v-if="file.parserId" class="chip chip-mono">{{ file.parserId }}</span>
                <span v-else class="muted small">未命中</span>
                <div v-if="file.parsersExecuted.length" class="muted small">
                  执行：{{ file.parsersExecuted.join(' → ') }}
                </div>
                <div v-for="err in file.parserErrors" :key="err" class="text-danger small">
                  {{ err }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
