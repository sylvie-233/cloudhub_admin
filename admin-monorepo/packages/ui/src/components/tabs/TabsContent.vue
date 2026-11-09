<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { TabsContentProps } from 'reka-ui';
import { TabsContent } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <TabsContent
    v-bind="{ ...props, class: undefined }"
    :class="cn('outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', props.class)"
  >
    <slot />
  </TabsContent>
</template>
