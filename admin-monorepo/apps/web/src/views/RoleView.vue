<script setup lang="ts">
import type { RoleDetail, RoleListItem, RoleUserItem, Status } from '@cloudhub/types';
import { DATA_SCOPE_LABELS, DATA_SCOPE_NOTES, PERMS } from '@cloudhub/types';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@cloudhub/ui';
import {
  ArrowRight,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { roleApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import RoleFormDialog from '@/components/role/RoleFormDialog.vue';
import RoleMembersDialog from '@/components/role/RoleMembersDialog.vue';
import { findMenuPathByPerm } from '@/router/menu-routes';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const permissionsPath = computed(() =>
  findMenuPathByPerm(auth.profile?.menus ?? [], PERMS.PERM_LIST),
);

const roles = ref<RoleListItem[]>([]);
const listLoading = ref(false);
const listError = ref('');
const selectedRoleId = ref<number | null>(null);
const detail = ref<RoleDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref('');

const keyword = ref('');
const filterStatus = ref<'all' | Status>('all');

const canReadDetail = computed(() => auth.hasPerm(PERMS.ROLE_QUERY));
/** 移除成员只调用角色成员接口，无需用户列表权限。 */
const canAssignRoleUsers = computed(() => auth.hasPerm(PERMS.ROLE_AUTH_USER));
/** 添加成员需要拉取用户候选列表。 */
const canManageMembers = computed(
  () => canAssignRoleUsers.value && auth.hasPerm(PERMS.USER_LIST),
);

let listRequestId = 0;
let detailRequestId = 0;

/** 清空详情并使仍在途的详情请求失效。 */
function clearDetail(): void {
  detailRequestId += 1;
  detail.value = null;
  detailLoading.value = false;
  detailError.value = '';
}

async function loadRoleList(preferredId?: number): Promise<boolean> {
  const requestId = ++listRequestId;
  listLoading.value = true;
  listError.value = '';
  try {
    const list = await roleApi.list({
      keyword: keyword.value.trim() || undefined,
      status: filterStatus.value === 'all' ? undefined : filterStatus.value,
    });
    if (requestId !== listRequestId) {
      return false;
    }
    roles.value = list;
    const preferredExists =
      preferredId !== undefined && roles.value.some((role) => role.roleId === preferredId);
    const selectedExists = roles.value.some((role) => role.roleId === selectedRoleId.value);
    const nextId =
      preferredExists
        ? preferredId
        : selectedExists
          ? selectedRoleId.value
          : (roles.value[0]?.roleId ?? null);
    selectedRoleId.value = nextId;
    if (nextId !== null && canReadDetail.value) {
      await loadRoleDetail(nextId);
    } else {
      clearDetail();
    }
    return true;
  } catch (error) {
    if (requestId !== listRequestId) {
      return false;
    }
    roles.value = [];
    selectedRoleId.value = null;
    clearDetail();
    listError.value = error instanceof Error ? error.message : '角色列表加载失败';
    return false;
  } finally {
    if (requestId === listRequestId) {
      listLoading.value = false;
    }
  }
}

async function loadRoleDetail(roleId: number): Promise<void> {
  const requestId = ++detailRequestId;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const result = await roleApi.detail(roleId);
    if (requestId !== detailRequestId) {
      return;
    }
    detail.value = result;
  } catch (error) {
    if (requestId !== detailRequestId) {
      return;
    }
    detail.value = null;
    detailError.value = error instanceof Error ? error.message : '角色详情加载失败';
  } finally {
    if (requestId === detailRequestId) {
      detailLoading.value = false;
    }
  }
}

function selectRole(roleId: number): void {
  if (roleId === selectedRoleId.value) {
    if (!detail.value && !detailLoading.value && canReadDetail.value) {
      void loadRoleDetail(roleId);
    }
    return;
  }
  selectedRoleId.value = roleId;
  if (canReadDetail.value) {
    void loadRoleDetail(roleId);
  } else {
    clearDetail();
  }
}

function applyFilters(): void {
  void loadRoleList();
}

function resetFilters(): void {
  keyword.value = '';
  filterStatus.value = 'all';
  void loadRoleList();
}

/** 中文输入法确认候选词时不应触发查询。 */
function handleKeywordEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  applyFilters();
}

async function refreshAll(): Promise<void> {
  const ok = await loadRoleList();
  if (ok) {
    toast.success('角色数据已刷新');
  }
}

/* ==================== 新增 / 编辑角色 ==================== */
const formOpen = ref(false);
const editTarget = ref<RoleListItem | null>(null);
const formSaving = ref(false);
const formError = ref('');

function openCreate(): void {
  editTarget.value = null;
  formError.value = '';
  formOpen.value = true;
}

function openEdit(): void {
  if (!detail.value) {
    return;
  }
  editTarget.value = detail.value;
  formError.value = '';
  formOpen.value = true;
}

async function handleRoleSubmit(payload: {
  roleId?: number;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope: '1' | '2' | '3' | '4' | '5';
  status: Status;
  remark: string | null;
}): Promise<void> {
  formSaving.value = true;
  formError.value = '';
  try {
    if (payload.roleId) {
      const updated = await roleApi.update(payload.roleId, {
        roleName: payload.roleName,
        roleKey: payload.roleKey,
        roleSort: payload.roleSort,
        dataScope: payload.dataScope,
        status: payload.status,
        remark: payload.remark,
      });
      toast.success('角色信息已更新');
      formOpen.value = false;
      await loadRoleList(updated.roleId);
    } else {
      const created = await roleApi.create({
        roleName: payload.roleName,
        roleKey: payload.roleKey,
        roleSort: payload.roleSort,
        dataScope: payload.dataScope,
        status: payload.status,
        remark: payload.remark,
      });
      toast.success('角色创建成功');
      formOpen.value = false;
      await loadRoleList(created.roleId);
    }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '角色保存失败';
  } finally {
    formSaving.value = false;
  }
}

/* ==================== 角色成员 ==================== */
const membersOpen = ref(false);
const membersSaving = ref(false);
const membersError = ref('');

function openMembers(): void {
  if (!detail.value || !canManageMembers.value) {
    return;
  }
  membersError.value = '';
  membersOpen.value = true;
}

async function handleMembersSubmit(userIds: number[]): Promise<void> {
  if (!detail.value) {
    return;
  }
  membersSaving.value = true;
  membersError.value = '';
  try {
    await roleApi.assignUsers(detail.value.roleId, { userIds });
    toast.success('角色成员已更新');
    membersOpen.value = false;
    await loadRoleList(detail.value.roleId);
  } catch (error) {
    membersError.value = error instanceof Error ? error.message : '角色成员保存失败';
  } finally {
    membersSaving.value = false;
  }
}

/* ==================== 删除角色 / 移除成员 ==================== */
const deleteOpen = ref(false);
const deleting = ref(false);

function askDeleteRole(): void {
  deleteOpen.value = true;
}

async function handleDeleteRole(): Promise<void> {
  if (!detail.value) {
    return;
  }
  deleting.value = true;
  try {
    await roleApi.remove(detail.value.roleId);
    toast.success('角色已删除');
    deleteOpen.value = false;
    selectedRoleId.value = null;
    await loadRoleList();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '删除角色失败');
  } finally {
    deleting.value = false;
  }
}

const removeMemberOpen = ref(false);
const removeTarget = ref<RoleUserItem | null>(null);
const removingMember = ref(false);

function askRemoveMember(user: RoleUserItem): void {
  if (detail.value?.roleId === 1 && user.userId === 1) {
    toast.error('超级管理员角色必须保留内置 admin 用户');
    return;
  }
  removeTarget.value = user;
  removeMemberOpen.value = true;
}

async function handleRemoveMember(): Promise<void> {
  if (!detail.value || !removeTarget.value) {
    return;
  }
  removingMember.value = true;
  try {
    const userIds = detail.value.users
      .filter((user) => user.userId !== removeTarget.value?.userId)
      .map((user) => user.userId);
    await roleApi.assignUsers(detail.value.roleId, { userIds });
    toast.success('角色成员已移除');
    removeMemberOpen.value = false;
    await loadRoleList(detail.value.roleId);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '移除成员失败');
  } finally {
    removingMember.value = false;
  }
}

onMounted(() => {
  void loadRoleList();
});
</script>

<template>
  <div class="mx-auto max-w-[1500px]">
    <PageHeader title="角色管理" description="角色直接授予用户功能权限，并负责携带数据范围；岗位与组织直授不携带数据范围。">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="listLoading" @click="refreshAll">
          <RefreshCw class="size-4" :class="listLoading && 'animate-spin'" />
          刷新
        </Button>
        <Button v-if="auth.hasPerm(PERMS.ROLE_ADD)" size="sm" @click="openCreate">
          <Plus class="size-4" />
          新增角色
        </Button>
      </template>
    </PageHeader>

    <div class="grid min-h-[36rem] gap-3 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <!-- 角色列表 -->
      <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div class="flex items-center gap-2">
            <ShieldCheck class="size-4 text-primary" />
            <span class="text-sm font-semibold">角色清单</span>
            <Badge variant="muted">{{ roles.length }}</Badge>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-b p-2">
          <div class="relative min-w-28 flex-1">
            <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="keyword"
              aria-label="搜索角色名称或权限字符"
              placeholder="搜索角色名或权限字符"
              class="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              @keydown.enter="handleKeywordEnter"
            />
          </div>
          <Select v-model="filterStatus" class="w-24">
            <SelectTrigger class="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" class="h-8 px-2.5 text-xs" @click="applyFilters">
            查询
          </Button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <div v-if="listLoading" class="space-y-1.5 p-1">
            <div v-for="index in 8" :key="index" class="h-16 animate-pulse rounded-lg bg-muted" />
          </div>
          <div
            v-else-if="listError"
            class="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center"
            role="alert"
          >
            <p class="text-xs leading-relaxed text-destructive">{{ listError }}</p>
            <Button variant="outline" size="sm" @click="loadRoleList()">
              <RefreshCw class="size-3.5" />
              重试
            </Button>
          </div>
          <template v-else-if="roles.length">
            <button
              v-for="role in roles"
              :key="role.roleId"
              type="button"
              class="mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left transition-colors"
              :class="
                role.roleId === selectedRoleId
                  ? 'border-primary bg-accent/60'
                  : 'border-transparent hover:border-border hover:bg-muted/40'
              "
              @click="selectRole(role.roleId)"
            >
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ role.roleName }}</span>
                <StatusBadge :status="role.status" />
              </div>
              <p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ role.roleKey }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline">{{ DATA_SCOPE_LABELS[role.dataScope] }}</Badge>
                <span>{{ role.userCount }} 人</span>
                <span>·</span>
                <span>{{ role.menuCount }} 项权限</span>
                <Badge v-if="role.roleId === 1" variant="warning" class="ml-auto">内置</Badge>
              </div>
            </button>
          </template>
          <EmptyState v-else compact text="没有匹配的角色">
            <Button variant="ghost" size="sm" @click="resetFilters">重置筛选</Button>
          </EmptyState>
        </div>
      </div>

      <!-- 角色详情与成员 -->
      <div class="min-w-0">
        <div v-if="detailLoading" class="space-y-3">
          <div class="h-36 animate-pulse rounded-xl bg-muted" />
          <div class="h-80 animate-pulse rounded-xl bg-muted" />
        </div>

        <div
          v-else-if="detail"
          class="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-3 border-b p-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">{{ detail.roleName }}</h2>
                <Badge variant="outline" class="font-mono">{{ detail.roleKey }}</Badge>
                <StatusBadge :status="detail.status" />
                <Badge v-if="detail.roleId === 1" variant="warning">内置超级管理员</Badge>
              </div>
              <p class="mt-1.5 text-xs text-muted-foreground">
                排序 {{ detail.roleSort }} · {{ detail.userCount }} 位成员 ·
                {{ detail.menuCount }} 项菜单权限 · 创建于 {{ detail.createTime }}
              </p>
              <p v-if="detail.remark" class="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {{ detail.remark }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <Button
                v-if="permissionsPath"
                variant="outline"
                size="sm"
                as-child
              >
                <RouterLink
                  :to="{ path: permissionsPath ?? '/dashboard', query: { roleId: String(detail.roleId) } }"
                >
                  <KeyRound class="size-3.5" />
                  配置权限
                  <ArrowRight class="size-3.5" />
                </RouterLink>
              </Button>
              <Button
                v-if="auth.hasPerm(PERMS.ROLE_EDIT)"
                variant="outline"
                size="sm"
                @click="openEdit"
              >
                <Pencil class="size-3.5" />
                编辑
              </Button>
              <Button
                v-if="auth.hasPerm(PERMS.ROLE_REMOVE) && detail.roleId !== 1"
                variant="destructive"
                size="sm"
                @click="askDeleteRole"
              >
                <Trash2 class="size-3.5" />
                删除
              </Button>
            </div>
          </div>

          <div class="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-[auto_1fr]">
            <div class="rounded-lg border bg-background px-4 py-3">
              <p class="text-[11px] text-muted-foreground">数据范围</p>
              <p class="mt-1 text-sm font-medium">{{ DATA_SCOPE_LABELS[detail.dataScope] }}</p>
            </div>
            <div class="flex items-center px-1 text-xs leading-relaxed text-muted-foreground">
              {{ DATA_SCOPE_NOTES[detail.dataScope] }}
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div class="flex items-center gap-2">
              <Users class="size-4 text-primary" />
              <span class="text-sm font-semibold">角色成员</span>
              <Badge variant="muted">{{ detail.users.length }}</Badge>
            </div>
            <span
              v-if="detail.roleId === 1"
              class="ml-auto text-xs text-amber-600"
            >
              内置角色成员固定为 admin
            </span>
            <Button
              v-else-if="canManageMembers"
              variant="outline"
              size="sm"
              class="ml-auto"
              @click="openMembers"
            >
              <Plus class="size-3.5" />
              添加成员
            </Button>
          </div>

          <div class="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="pl-4">用户</TableHead>
                  <TableHead>任职岗位</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>岗位直授</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead class="pr-4 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="detail.users.length">
                  <TableRow v-for="user in detail.users" :key="user.userId">
                    <TableCell class="pl-4">
                      <div class="flex items-center gap-2.5">
                        <span
                          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        >
                          {{ user.nickName.slice(0, 1) }}
                        </span>
                        <div class="min-w-0">
                          <p class="truncate text-sm font-medium">
                            {{ user.nickName }}
                            <Badge v-if="user.userId === 1" variant="warning">admin</Badge>
                          </p>
                          <p class="truncate font-mono text-[11px] text-muted-foreground">
                            {{ user.userName }}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div class="flex flex-wrap gap-1">
                        <Badge
                          v-for="post in user.posts.slice(0, 2)"
                          :key="post.postId"
                          variant="outline"
                          class="max-w-40"
                          :title="`${post.orgPath} / ${post.postName}`"
                        >
                          <span class="truncate">{{ post.postName }}</span>
                        </Badge>
                        <Badge v-if="user.posts.length > 2" variant="muted">
                          +{{ user.posts.length - 2 }}
                        </Badge>
                        <span v-if="!user.posts.length" class="text-xs text-muted-foreground">—</span>
                      </div>
                    </TableCell>
                    <TableCell class="font-mono text-xs text-muted-foreground">
                      {{ user.phonenumber || '—' }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ user.postPermCount }} 项
                    </TableCell>
                    <TableCell>
                      <StatusBadge :status="user.status" />
                    </TableCell>
                    <TableCell class="pr-4 text-right">
                      <Button
                        v-if="canAssignRoleUsers"
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground hover:text-destructive"
                        @click="askRemoveMember(user)"
                      >
                        <UserMinus class="size-3.5" />
                        移除
                      </Button>
                    </TableCell>
                  </TableRow>
                </template>
                <TableRow v-else>
                  <TableCell colspan="6">
                    <EmptyState compact text="该角色暂无成员">
                      <Button
                        v-if="canManageMembers && detail.roleId !== 1"
                        variant="outline"
                        size="sm"
                        @click="openMembers"
                      >
                        添加成员
                      </Button>
                    </EmptyState>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div
          v-else-if="selectedRoleId !== null && !canReadDetail"
          class="flex min-h-80 items-center justify-center rounded-xl border bg-card shadow-sm"
        >
          <EmptyState text="缺少角色详情查询权限，无法查看所选角色" />
        </div>

        <div
          v-else-if="detailError"
          class="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center"
          role="alert"
        >
          <p class="text-sm text-destructive">{{ detailError }}</p>
          <Button
            variant="outline"
            size="sm"
            :disabled="detailLoading || selectedRoleId === null"
            @click="selectedRoleId !== null && loadRoleDetail(selectedRoleId)"
          >
            <RefreshCw class="size-3.5" />
            重试
          </Button>
        </div>

        <div
          v-else
          class="flex min-h-80 items-center justify-center rounded-xl border bg-card shadow-sm"
        >
          <EmptyState text="请选择左侧角色查看详情" />
        </div>
      </div>
    </div>

    <RoleFormDialog
      v-model:open="formOpen"
      :role="editTarget"
      :saving="formSaving"
      :error="formError"
      @submit="handleRoleSubmit"
    />

    <RoleMembersDialog
      v-model:open="membersOpen"
      :role="detail"
      :saving="membersSaving"
      :error="membersError"
      @submit="handleMembersSubmit"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="删除角色"
      :description="`确认删除角色「${detail?.roleName ?? ''}」？仍有成员或权限关联时请先清理。`"
      confirm-text="删除"
      destructive
      :loading="deleting"
      :close-disabled="deleting"
      @confirm="handleDeleteRole"
    />

    <ConfirmDialog
      v-model:open="removeMemberOpen"
      title="移除角色成员"
      :description="`确认将「${removeTarget?.nickName ?? ''}」移出当前角色？其余角色与岗位权限不受影响。`"
      confirm-text="移除"
      destructive
      :loading="removingMember"
      :close-disabled="removingMember"
      @confirm="handleRemoveMember"
    />
  </div>
</template>
