<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { SelectContentEmits, SelectContentProps } from 'reka-ui';
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<SelectContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<SelectContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="forwarded"
      :class="
        cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <SelectViewport class="p-1">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
