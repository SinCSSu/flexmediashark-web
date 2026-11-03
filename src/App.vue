<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ConfigView from '@/views/ConfigView.vue'
import JobDetailView from '@/views/JobDetailView.vue'
import JobsView from '@/views/JobsView.vue'
import PreviewView from '@/views/PreviewView.vue'
import ReviewView from '@/views/ReviewView.vue'
import { getApiBase, setApiBase } from '@/api/client'
import { useToast } from '@/composables/useToast'

type ViewName = 'jobs' | 'job' | 'preview' | 'review' | 'config'

const view = ref<ViewName>('jobs')
const currentJobId = ref('')
const apiBaseInput = ref(getApiBase())
const health = ref<'unknown' | 'up' | 'down'>('unknown')
const { toasts, remove } = useToast()

const NAV: { key: ViewName; label: string; hint: string }[] = [
  { key: 'jobs', label: '刮削任务', hint: '提交与追踪' },
  { key: 'preview', label: '识别预览', hint: '只解析不刮削' },
  { key: 'review', label: '待复核', hint: '确认 / 拒绝 / 锁定' },
  { key: 'config', label: '插件配置', hint: '三族同权' },
]

function navigate(name: ViewName): void {
  view.value = name
}

function openJob(id: string): void {
  currentJobId.value = id
  view.value = 'job'
}

function applyApiBase(): void {
  setApiBase(apiBaseInput.value)
  void checkHealth()
}

async function checkHealth(): Promise<void> {
  try {
    const response = await fetch(`${getApiBase()}/actuator/health`)
    health.value = response.ok ? 'up' : 'down'
  } catch {
    health.value = 'down'
  }
}

let timer: number | undefined
onMounted(() => {
  void checkHealth()
  timer = window.setInterval(() => void checkHealth(), 30_000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">FMS</div>
        <div>
          <p class="brand-name">FlexMediaShark</p>
          <p class="brand-sub">影片元数据刮削器</p>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in NAV"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: view === item.key || (item.key === 'jobs' && view === 'job') }"
          @click="navigate(item.key)"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-hint">{{ item.hint }}</span>
        </button>
      </nav>

      <div class="sidebar-foot">
        <div class="health">
          <span class="dot" :class="`dot-${health}`" />
          <span class="muted small">
            {{ health === 'up' ? '后端在线' : health === 'down' ? '后端不可达' : '检测中' }}
          </span>
        </div>
        <div class="base-editor">
          <input v-model="apiBaseInput" class="input input-sm" placeholder="留空用同源 / 代理" />
          <button class="btn btn-ghost btn-sm" @click="applyApiBase">应用</button>
        </div>
        <p class="muted tiny">例如 http://192.168.1.10:8080</p>
      </div>
    </aside>

    <main class="main">
      <JobsView v-if="view === 'jobs'" @open="openJob" />
      <JobDetailView
        v-else-if="view === 'job'"
        :key="currentJobId"
        :job-id="currentJobId"
        @back="navigate('jobs')"
      />
      <PreviewView v-else-if="view === 'preview'" />
      <ReviewView v-else-if="view === 'review'" />
      <ConfigView v-else />
    </main>

    <div class="toast-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast-${toast.kind}`"
        @click="remove(toast.id)"
      >
        {{ toast.text }}
      </div>
    </div>
  </div>
</template>
