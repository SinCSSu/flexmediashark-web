<script setup lang="ts">
import { computed } from 'vue'
import { percent } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    value: number
    total: number
    tone?: string
    height?: number
  }>(),
  { tone: 'accent', height: 8 },
)

const ratio = computed(() => percent(props.value, props.total))
</script>

<template>
  <div class="progress" :style="{ height: `${height}px` }">
    <div class="progress-fill" :class="`fill-${tone}`" :style="{ width: `${ratio}%` }" />
  </div>
</template>
