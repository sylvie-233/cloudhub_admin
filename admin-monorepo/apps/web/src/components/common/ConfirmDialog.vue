<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { default: false });

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    loading?: boolean;
    /** 是否额外禁止关闭弹窗；loading 为 true 时也会自动禁止。 */
    closeDisabled?: boolean;
  }>(),
  {
    description: '',
    confirmText: '确定',
    cancelText: '取消',
    destructive: false,
    loading: false,
    closeDisabled: false,
  },
);

const emit = defineEmits<{
  confirm: [];
}>();

function handleConfirm(): void {
  if (!props.loading) {
    emit('confirm');
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-md"
      :close-disabled="props.loading || props.closeDisabled"
    >
      <DialogHeader>
        <DialogTitle>{{ props.title }}</DialogTitle>
        <DialogDescription>
          {{ props.description || '请确认是否继续该操作。' }}
        </DialogDescription>
      </DialogHeader>
      <slot />
      <DialogFooter>
        <Button variant="outline" :disabled="props.loading" @click="open = false">
          {{ props.cancelText }}
        </Button>
        <Button
          :variant="props.destructive ? 'destructive' : 'default'"
          :disabled="props.loading"
          @click="handleConfirm"
        >
          <Loader2 v-if="props.loading" class="size-4 animate-spin" />
          {{ props.confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
