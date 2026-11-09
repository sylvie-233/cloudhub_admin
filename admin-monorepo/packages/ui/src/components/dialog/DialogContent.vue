<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import { X } from 'lucide-vue-next';

import { cn } from '../../lib/utils';

const props = defineProps<
  DialogContentProps & {
    class?: HTMLAttributes['class'];
    /** 为 true 时禁止通过遮罩、Esc 或关闭按钮退出（提交中常用）。 */
    closeDisabled?: boolean;
  }
>();
const emits = defineEmits<DialogContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);

function blockDismiss(event: Event): void {
  if (props.closeDisabled) {
    event.preventDefault();
  }
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background p-6 shadow-xl duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
      @escape-key-down="blockDismiss"
      @pointer-down-outside="blockDismiss"
      @interact-outside="blockDismiss"
    >
      <slot />
      <DialogClose
        v-if="!props.closeDisabled"
        aria-label="关闭"
        class="absolute top-4 right-4 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-accent hover:opacity-100"
      >
        <X class="size-4" />
        <span class="sr-only">关闭</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
