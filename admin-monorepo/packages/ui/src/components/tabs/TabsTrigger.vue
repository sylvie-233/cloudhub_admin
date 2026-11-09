<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { TabsTriggerProps } from 'reka-ui';
import { TabsTrigger } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <TabsTrigger
    v-bind="{ ...props, class: undefined }"
    :class="
      cn(
        'inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-2 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
