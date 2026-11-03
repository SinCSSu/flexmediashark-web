<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getConfig, updateParser, updateProvider, updateSink } from '@/api/client'
import type { ConfigResponse, ConfigUpdateRequest } from '@/api/types'
import PluginCard from '@/components/PluginCard.vue'
import { describeError, useToast } from '@/composables/useToast'

const toast = useToast()

const config = ref<ConfigResponse | null>(null)
const loading = ref(false)
const saving = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    config.value = await getConfig()
  } catch (error) {
    toast.error(describeError(error, '加载配置失败'))
  } finally {
    loading.value = false
  }
}

async function save(
  key: string,
  id: string,
  action: (pluginId: string, payload: ConfigUpdateRequest) => Promise<ConfigResponse>,
  payload: ConfigUpdateRequest,
): Promise<void> {
  saving.value = key
  try {
    config.value = await action(id, payload)
    toast.success('配置已更新，后续任务使用新配置。')
  } catch (error) {
    toast.error(describeError(error, '保存失败'))
  } finally {
    saving.value = null
  }
}

function onSaveProvider(id: string, payload: ConfigUpdateRequest): void {
  void save(`provider:${id}`, id, updateProvider, payload)
}

function onSaveParser(id: string, payload: ConfigUpdateRequest): void {
  void save(`parser:${id}`, id, updateParser, payload)
}

function onSaveSink(id: string, payload: ConfigUpdateRequest): void {
  void save(`sink:${id}`, id, updateSink, payload)
}

function schemeLabel(scheme: string): string {
  return scheme === 'PROVIDER_NATIVE' ? '以数据源季集结构为准' : '以绝对集号为准'
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="stack">
    <section class="card">
      <header class="card-head">
        <div>
          <h2 class="card-title">生效中的配置快照</h2>
          <p class="card-sub">
            三族插件（数据源 / 命名解析器 / 输出目标）同权：都能单独启停、调序与传参。
          </p>
        </div>
        <button class="btn btn-ghost btn-sm" :disabled="loading" @click="load">刷新</button>
      </header>

      <dl v-if="config" class="meta meta-wide">
        <div>
          <dt>自动确认阈值</dt>
          <dd class="mono">{{ config.autoThreshold }}</dd>
        </div>
        <div>
          <dt>集号方案</dt>
          <dd>{{ schemeLabel(config.numberingScheme) }}</dd>
        </div>
        <div>
          <dt>默认语言</dt>
          <dd class="mono">{{ config.language }}</dd>
        </div>
        <div>
          <dt>快照指纹</dt>
          <dd class="mono">{{ config.snapshotFingerprint }}</dd>
        </div>
      </dl>
      <p v-else class="muted">加载中…</p>
    </section>

    <template v-if="config">
      <section class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">数据源 Providers</h2>
            <p class="card-sub">priority 越小越优先，决定「谁先搜」；单源超时/限流会自动降级跳过。</p>
          </div>
        </header>
        <div v-if="config.providers.length" class="plugin-grid">
          <PluginCard
            v-for="provider in config.providers"
            :key="provider.id"
            kind="provider"
            :id="provider.id"
            :display-name="provider.displayName"
            :enabled="provider.enabled"
            :priority="provider.priority"
            :configured-keys="provider.configuredKeys"
            :tags="[
              ...provider.mediaKinds,
              ...provider.languages,
              ...(provider.supportsLookupByExternalRef ? ['支持外部编号'] : []),
            ]"
            @save="onSaveProvider(provider.id, $event)"
          />
        </div>
        <p v-else class="muted">没有注册数据源插件。</p>
      </section>

      <section class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">命名解析器 Parsers</h2>
            <p class="card-sub">
              order 越小越先执行，链式择优；识别错了可以直接关掉某个解析器再试。
            </p>
          </div>
        </header>
        <div v-if="config.parsers.length" class="plugin-grid">
          <PluginCard
            v-for="parser in config.parsers"
            :key="parser.id"
            kind="parser"
            :id="parser.id"
            :display-name="parser.displayName"
            :enabled="parser.enabled"
            :order="parser.order"
            :configured-keys="parser.configuredKeys"
            @save="onSaveParser(parser.id, $event)"
          />
        </div>
        <p v-else class="muted">没有注册命名解析器插件。</p>
      </section>

      <section class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">输出目标 Sinks</h2>
            <p class="card-sub">可同时启用多个，各自声明需要的字段与图片，服务据此裁剪产物。</p>
          </div>
        </header>
        <div v-if="config.sinks.length" class="plugin-grid">
          <PluginCard
            v-for="sink in config.sinks"
            :key="sink.id"
            kind="sink"
            :id="sink.id"
            :display-name="sink.displayName"
            :enabled="sink.enabled"
            :priority="sink.priority"
            :configured-keys="sink.configuredKeys"
            @save="onSaveSink(sink.id, $event)"
          />
        </div>
        <p v-else class="muted">没有注册输出目标插件。</p>
      </section>
    </template>
    <p v-if="saving" class="muted small">保存中：{{ saving }}</p>
  </div>
</template>
