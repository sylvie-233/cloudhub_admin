<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { PopoverContentEmits, PopoverContentProps } from 'reka-ui';
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    align: 'start',
    sideOffset: 6,
    class: undefined,
  },
);
const emits = defineEmits<PopoverContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="forwarded"
      :class="
        cn(
          'z-50 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
