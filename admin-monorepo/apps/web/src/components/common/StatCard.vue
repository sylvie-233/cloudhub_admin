<script setup lang="ts">
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    icon: Component;
    tone?: 'blue' | 'green' | 'amber' | 'violet' | 'slate';
  }>(),
  { tone: 'blue', hint: '' },
);

const toneClasses: Record<NonNullable<typeof props.tone>, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-500',
};
</script>

<template>
  <div class="rounded-xl border bg-card p-5 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <span class="text-sm text-muted-foreground">{{ label }}</span>
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg"
        :class="toneClasses[props.tone]"
      >
        <component :is="props.icon" class="size-[18px]" />
      </span>
    </div>
    <b class="mt-2 block text-2xl font-semibold tracking-tight">{{ props.value }}</b>
    <span v-if="props.hint" class="mt-1 block text-xs text-muted-foreground">
      {{ props.hint }}
    </span>
  </div>
</template>
