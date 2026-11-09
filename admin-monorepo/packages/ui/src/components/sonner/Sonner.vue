<script setup lang="ts">
import 'vue-sonner/style.css';
import { computed } from 'vue';
import { Toaster, type ToasterProps } from 'vue-sonner';

const props = withDefaults(defineProps<ToasterProps>(), {
  position: 'top-right',
  richColors: true,
  closeButton: true,
});

/** 默认提示样式对齐 shadcn 主题变量，允许调用方通过 toastOptions 覆盖。 */
const defaultClasses = {
  toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
  description: 'group-[.toast]:text-muted-foreground',
  actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
  cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
};

const toastOptions = computed<ToasterProps['toastOptions']>(() => ({
  ...props.toastOptions,
  classes: {
    ...defaultClasses,
    ...props.toastOptions?.classes,
  },
}));
</script>

<template>
  <Toaster class="toaster group" v-bind="props" :toast-options="toastOptions" />
</template>
