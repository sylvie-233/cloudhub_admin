<script setup lang="ts">
import type { PostTreeNode, Status } from '@cloudhub/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';
import type { PostParentOption } from './types';

const props = withDefaults(
  defineProps<{
    post: PostTreeNode | null;
    orgId: number;
    parentOptions: PostParentOption[];
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [
    payload: {
      postId?: number;
      orgId: number;
      parentId: number;
      postName: string;
      postCode?: string;
      postSort: number;
      status: Status;
      isLeader: boolean;
    },
  ];
}>();

const form = ref({
  parentId: '0',
  postName: '',
  postCode: '',
  postSort: '0',
  status: '0' as Status,
  isLeader: false,
});
const localError = ref('');

const isEdit = computed(() => Boolean(props.post?.postId));
const displayError = computed(() => props.error || localError.value);

function init(): void {
  localError.value = '';
  if (props.post) {
    form.value = {
      parentId: String(props.post.parentId),
      postName: props.post.postName,
      postCode: props.post.postCode,
      postSort: String(props.post.postSort),
      status: props.post.status,
      isLeader: props.post.isLeader,
    };
  } else {
    form.value = {
      parentId: '0',
      postName: '',
      postCode: '',
      postSort: '0',
      status: '0',
      isLeader: false,
    };
  }
}

function handleSubmit(): void {
  const name = form.value.postName.trim();
  if (!name) {
    localError.value = '请输入岗位名称';
    return;
  }
  localError.value = '';
  emit('submit', {
    postId: props.post?.postId,
    orgId: props.orgId,
    parentId: Number(form.value.parentId),
    postName: name,
    postCode: form.value.postCode.trim() || undefined,
    postSort: Number(form.value.postSort) || 0,
    status: form.value.status,
    isLeader: form.value.isLeader,
  });
}

watch(
  [() => open.value, () => props.post],
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
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑岗位' : '新增岗位' }}</DialogTitle>
        <DialogDescription>
          岗位挂在组织下，可通过上级岗位形成汇报线；汇报线允许跨组织。
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormItem label="岗位名称" for="post-name" required>
          <Input id="post-name" v-model="form.postName" placeholder="如：前端工程师" maxlength="50" />
        </FormItem>

        <FormItem label="岗位编码" for="post-code" hint="留空将按 GW + 日期 + 序列生成">
          <Input id="post-code" v-model="form.postCode" placeholder="自动生成" maxlength="30" />
        </FormItem>

        <FormItem label="上级岗位" for="post-parent" hint="可选择其他组织的岗位">
          <Select v-model="form.parentId">
            <SelectTrigger id="post-parent" class="w-full">
              <SelectValue placeholder="无上级岗位" />
            </SelectTrigger>
            <SelectContent class="max-h-72">
              <SelectItem value="0">无上级岗位（根节点）</SelectItem>
              <SelectItem
                v-for="option in props.parentOptions"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="显示顺序" for="post-sort" hint="数字越小越靠前">
          <Input id="post-sort" v-model="form.postSort" type="number" min="0" />
        </FormItem>

        <FormItem label="状态" for="post-status">
          <Select v-model="form.status">
            <SelectTrigger id="post-status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="责任岗位" for="post-leader" hint="每个组织仅有一个责任岗位">
          <div
            class="flex h-9 items-center justify-between rounded-md border bg-background px-3"
          >
            <span class="text-sm">{{ form.isLeader ? '设为责任岗位' : '普通岗位' }}</span>
            <Switch id="post-leader" v-model="form.isLeader" />
          </div>
        </FormItem>
      </div>

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
          {{ isEdit ? '保存修改' : '创建岗位' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
