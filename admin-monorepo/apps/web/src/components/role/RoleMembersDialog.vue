<script setup lang="ts">
import type { RoleDetail, UserListItem } from '@cloudhub/types';
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
import { computed, ref, watch } from 'vue';

import { userApi } from '@/api';
import MultiSelect from '@/components/common/MultiSelect.vue';
import type { MultiSelectOption } from '@/components/common/types';

const props = withDefaults(
  defineProps<{
    role: RoleDetail | null;
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [userIds: number[]];
}>();

const users = ref<UserListItem[]>([]);
const selected = ref<number[]>([]);
const loading = ref(false);
const loadError = ref('');
const localError = ref('');

const displayError = computed(() => props.error || localError.value);

const userOptions = computed<MultiSelectOption[]>(() =>
  users.value.map((user) => {
    const primaryPost = user.posts[0];
    return {
      value: user.userId,
      label: `${user.nickName}（${user.userName}）`,
      group: primaryPost?.orgPath ?? '未分配岗位',
      hint: user.posts.length > 1 ? `${user.posts.length} 个岗位` : primaryPost?.postName,
    };
  }),
);

async function loadUsers(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const all: UserListItem[] = [];
    let page = 1;
    // pageSize 上限为 100，逐页拉取以保证「整体替换」拥有完整候选用户。
    for (;;) {
      const result = await userApi.list({ page, pageSize: 100 });
      all.push(...result.list);
      if (all.length >= result.total || result.list.length === 0 || page >= 50) {
        break;
      }
      page += 1;
    }
    users.value = all;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '用户列表加载失败';
  } finally {
    loading.value = false;
  }
}

function handleSubmit(): void {
  if (props.role?.roleId === 1 && !selected.value.includes(1)) {
    localError.value = '超级管理员角色必须保留内置 admin 用户';
    return;
  }
  localError.value = '';
  emit('submit', [...selected.value]);
}

watch(
  [() => open.value, () => props.role],
  () => {
    if (open.value) {
      localError.value = '';
      selected.value = (props.role?.users ?? []).map((user) => user.userId);
      void loadUsers();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>管理角色成员</DialogTitle>
        <DialogDescription>
          {{ props.role?.roleName }} · 保存时整体替换成员列表；角色只授予功能权限与数据范围。
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" />
        正在加载用户列表…
      </div>

      <template v-else-if="loadError">
        <p class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {{ loadError }}
        </p>
        <Button variant="outline" size="sm" @click="loadUsers">重新加载</Button>
      </template>

      <template v-else>
        <MultiSelect
          v-model="selected"
          aria-label="角色成员"
          :options="userOptions"
          placeholder="选择角色成员（可多选）"
          search-placeholder="搜索昵称、账号或组织"
          :max-chips="6"
        />
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>已选择 {{ selected.length }} / {{ users.length }} 位用户</span>
          <span v-if="props.role?.roleId === 1" class="text-amber-600">
            内置 admin 用户必须保留
          </span>
        </div>
      </template>

      <p
        v-if="displayError"
        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ displayError }}
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="props.saving" @click="open = false">取消</Button>
        <Button :disabled="props.saving || loading || Boolean(loadError)" @click="handleSubmit">
          <Loader2 v-if="props.saving" class="size-4 animate-spin" />
          保存成员
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
