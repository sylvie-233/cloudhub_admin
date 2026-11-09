<script setup lang="ts">
import type { RoleListItem, UserListItem } from '@cloudhub/types';
import { DATA_SCOPE_LABELS } from '@cloudhub/types';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import EmptyState from '@/components/common/EmptyState.vue';

const props = withDefaults(
  defineProps<{
    user: UserListItem | null;
    roles: RoleListItem[];
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [roleIds: number[]];
}>();

const selected = ref<number[]>([]);
const displayError = computed(() => props.error);

function toggle(roleId: number): void {
  selected.value = selected.value.includes(roleId)
    ? selected.value.filter((id) => id !== roleId)
    : [...selected.value, roleId];
}

function handleSubmit(): void {
  emit('submit', [...selected.value]);
}

watch(
  [() => open.value, () => props.user],
  () => {
    if (open.value) {
      selected.value = (props.user?.roles ?? []).map((role) => role.roleId);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>分配角色</DialogTitle>
        <DialogDescription>
          为 <b class="text-foreground">{{ props.user?.nickName }}</b> 选择角色；保存时整体替换现有角色。
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-80 overflow-y-auto rounded-lg border">
        <div
          v-for="role in props.roles"
          :key="role.roleId"
          class="flex cursor-pointer items-start gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/50"
          @click="toggle(role.roleId)"
        >
          <Checkbox
            :model-value="selected.includes(role.roleId)"
            class="mt-0.5"
            :aria-label="`选择角色 ${role.roleName}`"
            @click.stop
            @update:model-value="toggle(role.roleId)"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-sm font-medium">{{ role.roleName }}</span>
              <Badge variant="outline">{{ role.roleKey }}</Badge>
              <Badge v-if="role.roleId === 1" variant="warning">内置角色</Badge>
              <Badge v-if="role.status === '1'" variant="muted">停用</Badge>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ DATA_SCOPE_LABELS[role.dataScope] }} · {{ role.userCount }} 位成员 ·
              {{ role.menuCount }} 项菜单
            </p>
            <p v-if="role.remark" class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              {{ role.remark }}
            </p>
          </div>
        </div>
        <EmptyState v-if="!props.roles.length" compact text="暂无可分配角色" />
      </div>

      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>已选择 {{ selected.length }} 个角色</span>
        <span>功能权限 = 角色 ∪ 岗位 ∪ 组织</span>
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
          保存角色
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
