<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '../../lib/utils';

const model = defineModel<string | number>();
const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <input
    v-model="model"
    :class="
      cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
