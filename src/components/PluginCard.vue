<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ConfigUpdateRequest } from '@/api/types'

const props = defineProps<{
  kind: 'provider' | 'parser' | 'sink'
  id: string
  displayName: string
  enabled: boolean
  priority?: number | undefined
  order?: number | undefined
  configuredKeys: string[]
  tags?: string[]
}>()

const emit = defineEmits<{ save: [payload: ConfigUpdateRequest] }>()

interface Row {
  key: string
  value: string
  isNew: boolean
}

const enabledDraft = ref(props.enabled)
const orderDraft = ref(props.order ?? props.priority ?? 0)
const rows = ref<Row[]>([])

watch(
  () => [props.enabled, props.order, props.priority, props.configuredKeys.join(',')],
  () => {
    enabledDraft.value = props.enabled
    orderDraft.value = props.order ?? props.priority ?? 0
    rows.value = props.configuredKeys.map((key) => ({ key, value: '', isNew: false }))
  },
  { immediate: true },
)

const kindLabel = (): string =>
  props.kind === 'provider' ? '数据源' : props.kind === 'parser' ? '命名解析器' : '输出目标'

const orderLabel = (): string => (props.kind === 'parser' ? '执行顺序 order' : '优先级 priority')

const isSecret = (key: string): boolean =>
  /(key|token|cookie|secret|password)/i.test(key)

function addRow(): void {
  rows.value = [...rows.value, { key: '', value: '', isNew: true }]
}

function removeRow(index: number): void {
  rows.value = rows.value.filter((_, i) => i !== index)
}

function onSave(): void {
  const payload: ConfigUpdateRequest = { enabled: enabledDraft.value }
  if (props.kind === 'parser') payload.order = orderDraft.value
  else payload.priority = orderDraft.value

  const settings: Record<string, string> = {}
  for (const row of rows.value) {
    if (row.key.trim() && row.value) settings[row.key.trim()] = row.value
  }
  if (Object.keys(settings).length) payload.settings = settings

  emit('save', payload)
  rows.value = rows.value.map((row) => ({ ...row, value: '' }))
}
</script>

<template>
  <article class="plugin" :class="{ disabled: !enabledDraft }">
    <header class="plugin-head">
      <div>
        <p class="plugin-title">
          {{ displayName }}
          <span class="mono small muted">{{ id }}</span>
        </p>
        <div class="plugin-tags">
          <span class="chip chip-kind">{{ kindLabel() }}</span>
          <span v-for="tag in tags ?? []" :key="tag" class="chip">{{ tag }}</span>
        </div>
      </div>
      <label class="switch">
        <input v-model="enabledDraft" type="checkbox" />
        <span class="switch-track"><span class="switch-thumb" /></span>
        <span class="switch-text">{{ enabledDraft ? '启用' : '停用' }}</span>
      </label>
    </header>

    <div class="plugin-body">
      <label class="label">{{ orderLabel() }}</label>
      <input v-model.number="orderDraft" class="input input-sm" type="number" />
      <span class="muted small">
        {{ kind === 'parser' ? 'order 越小越先执行' : 'priority 越小越优先' }}
      </span>
    </div>

    <div class="plugin-settings">
      <div class="settings-head">
        <span class="label">参数</span>
        <button type="button" class="btn btn-ghost btn-xs" @click="addRow">+ 新增</button>
      </div>
      <p class="muted small">后端只回显键名，值留空表示不修改。凭据类参数不会回显明文。</p>

      <div class="settings-rows">
        <div v-for="(row, index) in rows" :key="index" class="settings-row">
          <input
            v-if="row.isNew"
            v-model="row.key"
            class="input input-sm"
            placeholder="参数名"
          />
          <span v-else class="settings-key mono">{{ row.key }}</span>
          <input
            v-model="row.value"
            class="input input-sm"
            :type="isSecret(row.key) ? 'password' : 'text'"
            placeholder="留空不修改"
            autocomplete="off"
          />
          <button
            v-if="row.isNew"
            type="button"
            class="btn btn-ghost btn-xs"
            @click="removeRow(index)"
          >
            ×
          </button>
        </div>
        <p v-if="!rows.length" class="muted small">该插件没有可配置参数。</p>
      </div>
    </div>

    <footer class="plugin-foot">
      <button class="btn btn-primary btn-sm" @click="onSave">保存</button>
      <span class="muted small">修改仅运行时生效，持久化请改 application.yaml</span>
    </footer>
  </article>
</template>
