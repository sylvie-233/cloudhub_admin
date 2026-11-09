<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { TabsListProps } from 'reka-ui';
import { TabsList } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <TabsList
    :class="
      cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground',
        props.class,
      )
    "
    v-bind="{ ...props, class: undefined }"
  >
    <slot />
  </TabsList>
</template>
