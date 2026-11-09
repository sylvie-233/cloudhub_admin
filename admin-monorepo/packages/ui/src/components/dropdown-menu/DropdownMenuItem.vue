<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from 'reka-ui';
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui';

import { cn } from '../../lib/utils';

const props = defineProps<
  DropdownMenuItemProps & {
    class?: HTMLAttributes['class'];
    variant?: 'default' | 'destructive';
  }
>();
const emits = defineEmits<DropdownMenuItemEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.variant === 'destructive'
          ? 'text-destructive focus:bg-destructive/10 focus:text-destructive'
          : 'focus:bg-accent focus:text-accent-foreground',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
