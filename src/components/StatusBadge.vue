<script setup lang="ts">
const props = defineProps<{ status: string }>()

const LABELS: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
  SUCCESS: '成功',
  SKIPPED: '跳过',
  AMBIGUOUS: '待复核',
  AUTO: '自动匹配',
  CONFIRMED: '已确认',
  REJECTED: '已拒绝',
}

const TONES: Record<string, string> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'warning',
  SUCCESS: 'success',
  SKIPPED: 'neutral',
  AMBIGUOUS: 'warning',
  AUTO: 'success',
  CONFIRMED: 'success',
  REJECTED: 'danger',
}

const tone = (): string => TONES[props.status] ?? 'neutral'
const label = (): string => LABELS[props.status] ?? props.status
</script>

<template>
  <span class="badge" :class="`badge-${tone()}`">{{ label() }}</span>
</template>
