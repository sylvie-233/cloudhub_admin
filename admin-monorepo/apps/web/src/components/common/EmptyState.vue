<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    text?: string;
    compact?: boolean;
  }>(),
  { text: '暂无数据', compact: false },
);
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 text-muted-foreground"
    :class="compact ? 'py-6' : 'py-14'"
  >
    <Inbox class="size-8 opacity-60" />
    <span class="text-sm">{{ text }}</span>
    <slot />
  </div>
</template>
