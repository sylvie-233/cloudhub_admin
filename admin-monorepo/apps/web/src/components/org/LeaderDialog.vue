<script setup lang="ts">
import type { PostTreeNode } from '@cloudhub/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';
import { flattenPostTree } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    orgName: string;
    posts: PostTreeNode[];
    currentLeaderId: number | null;
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [postId: number | null];
}>();

const selected = ref('0');

const postOptions = computed(() => flattenPostTree(props.posts));
const displayError = computed(() => props.error);

function init(): void {
  selected.value = props.currentLeaderId ? String(props.currentLeaderId) : '0';
}

function handleSubmit(): void {
  emit('submit', selected.value === '0' ? null : Number(selected.value));
}

watch(
  [() => open.value, () => props.currentLeaderId],
  () => {
    if (open.value) {
      init();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>设置责任岗位</DialogTitle>
        <DialogDescription>
          {{ props.orgName }} · 责任岗位的在岗人即该组织责任人，每个组织只能设置一个。
        </DialogDescription>
      </DialogHeader>

      <FormItem label="责任岗位" for="leader-post">
        <Select v-model="selected">
          <SelectTrigger id="leader-post" class="w-full">
            <SelectValue placeholder="选择责任岗位" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">不设置责任岗位</SelectItem>
            <SelectItem
              v-for="row in postOptions"
              :key="row.post.postId"
              :value="String(row.post.postId)"
            >
              {{ String.fromCharCode(0x3000).repeat(row.level) }}{{ row.post.postName }}
              （{{ row.post.headcount }} 人）
            </SelectItem>
          </SelectContent>
        </Select>
      </FormItem>

      <p
        v-if="displayError"
        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ displayError }}
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="props.saving" @click="open = false">取消</Button>
        <Button :disabled="props.saving" @click="handleSubmit">
          <Loader2 v-if="props.saving" class="size-4 animate-spin" />
          保存责任岗位
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
