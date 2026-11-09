<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { SelectTriggerProps } from 'reka-ui';
import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui';
import { ChevronDown } from 'lucide-vue-next';

import { cn } from '../../lib/utils';

const props = defineProps<SelectTriggerProps & { class?: HTMLAttributes['class'] }>();

const forwarded = useForwardProps(props);
</script>

<template>
  <SelectTrigger
    v-bind="forwarded"
    :class="
      cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 shrink-0 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
