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
    rolesLoading?: boolean;
    rolesError?: string;
    saving?: boolean;
    error?: string;
  }>(),
  { rolesLoading: false, rolesError: '', saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [roleIds: number[]];
  retry: [];
}>();

const selected = ref<number[]>([]);
const displayError = computed(() => props.error);
const selectedCount = computed(() =>
  selected.value.filter((roleId) => !props.roles.find((role) => role.roleId === roleId && role.status === '1')).length,
);

/**
 * 超级管理员角色只允许内置 admin 持有；停用角色不再可勾选，
 * 但已持有的停用角色允许取消，便于清理历史授权。
 */
function isRoleSelectable(role: RoleListItem): boolean {
  if (role.roleId === 1) {
    return props.user?.userId === 1;
  }
  return role.status !== '1' || selected.value.includes(role.roleId);
}

/** 内置 admin 的超级管理员角色固定保留，不允许取消。 */
function isRoleLocked(role: RoleListItem): boolean {
  return role.roleId === 1 && props.user?.userId === 1;
}

function toggle(role: RoleListItem): void {
  if (!isRoleSelectable(role) || isRoleLocked(role)) {
    return;
  }
  selected.value = selected.value.includes(role.roleId)
    ? selected.value.filter((id) => id !== role.roleId)
    : [...selected.value, role.roleId];
}

function handleSubmit(): void {
  emit('submit', [...selected.value]);
}

watch(
  [() => open.value, () => props.user],
  () => {
    if (open.value) {
      selected.value = (props.user?.roles ?? [])
        .map((role) => role.roleId)
        .filter((roleId) => props.user?.userId === 1 || roleId !== 1);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[90vh] max-w-lg overflow-y-auto"
      :close-disabled="props.saving"
    >
      <DialogHeader>
        <DialogTitle>分配角色</DialogTitle>
        <DialogDescription>
          为 <b class="text-foreground">{{ props.user?.nickName }}</b> 选择角色；保存时整体替换现有角色。
        </DialogDescription>
      </DialogHeader>

      <div v-if="props.rolesLoading" class="flex items-center justify-center gap-2 rounded-lg border py-10 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" />
        正在加载角色…
      </div>

      <div
        v-else-if="props.rolesError"
        class="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3"
      >
        <p class="text-xs text-destructive">{{ props.rolesError }}</p>
        <Button variant="outline" size="sm" @click="emit('retry')">重新加载</Button>
      </div>

      <div v-else class="max-h-80 overflow-y-auto rounded-lg border">
        <div
          v-for="role in props.roles"
          :key="role.roleId"
          class="flex items-start gap-3 border-b px-3 py-3 last:border-b-0"
          :class="
            isRoleSelectable(role) && !isRoleLocked(role)
              ? 'cursor-pointer hover:bg-muted/50'
              : 'bg-muted/20'
          "
          @click="toggle(role)"
        >
          <Checkbox
            :model-value="selected.includes(role.roleId)"
            class="mt-0.5"
            :disabled="!isRoleSelectable(role) || isRoleLocked(role)"
            :aria-label="`选择角色 ${role.roleName}`"
            @click.stop
            @update:model-value="toggle(role)"
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
            <p v-if="role.roleId === 1 && props.user?.userId !== 1" class="mt-1 text-[11px] text-amber-600">
              超级管理员角色仅限内置 admin 账号
            </p>
            <p v-else-if="role.roleId === 1" class="mt-1 text-[11px] text-amber-600">
              内置账号固定持有，不可取消
            </p>
            <p v-else-if="role.status === '1'" class="mt-1 text-[11px] text-amber-600">
              停用角色不会授予任何权限
            </p>
            <p v-if="role.remark" class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              {{ role.remark }}
            </p>
          </div>
        </div>
        <EmptyState v-if="!props.roles.length" compact text="暂无可分配角色" />
      </div>

      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>已选择 {{ selectedCount }} 个生效角色</span>
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
        <Button
          :disabled="props.saving || props.rolesLoading || Boolean(props.rolesError)"
          @click="handleSubmit"
        >
          <Loader2 v-if="props.saving" class="size-4 animate-spin" />
          保存角色
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
