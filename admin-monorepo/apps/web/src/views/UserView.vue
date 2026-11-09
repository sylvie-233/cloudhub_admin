<script setup lang="ts">
import type {
  OrgTreeNode,
  RoleListItem,
  Status,
  UserListItem,
} from '@cloudhub/types';
import { DATA_SCOPE_LABELS, PERMS } from '@cloudhub/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@cloudhub/ui';
import {
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';

import { orgApi, postApi, roleApi, userApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import Pagination from '@/components/common/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { MultiSelectOption } from '@/components/common/types';
import ResetPasswordDialog from '@/components/user/ResetPasswordDialog.vue';
import UserFormDialog from '@/components/user/UserFormDialog.vue';
import UserPermissionDialog from '@/components/user/UserPermissionDialog.vue';
import UserRolesDialog from '@/components/user/UserRolesDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { flattenOrgTree, flattenPostTree } from '@/utils/format';

const auth = useAuthStore();

/* ==================== 基础数据 ==================== */
const orgTree = ref<OrgTreeNode[]>([]);
const roles = ref<RoleListItem[]>([]);

const orgRows = computed(() => flattenOrgTree(orgTree.value));

const roleOptions = computed<MultiSelectOption[]>(() =>
  roles.value.map((role) => ({
    value: role.roleId,
    label: role.roleName,
    group: role.status === '1' ? '停用角色' : '可用角色',
    hint: role.roleKey,
  })),
);

let orgTreePromise: Promise<void> | null = null;

function loadOrgTree(): Promise<void> {
  if (orgTreePromise) {
    return orgTreePromise;
  }
  orgTreePromise = (async () => {
    try {
      orgTree.value = await orgApi.list();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组织树加载失败');
    } finally {
      orgTreePromise = null;
    }
  })();
  return orgTreePromise;
}

async function loadRoles(): Promise<void> {
  try {
    roles.value = await roleApi.list();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '角色列表加载失败');
  }
}

/* ==================== 用户列表 ==================== */
const users = ref<UserListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(false);

const keyword = ref('');
const filterOrgId = ref('0');
const filterStatus = ref<'all' | Status>('all');
const includeSub = ref(true);

let userListRequestId = 0;

async function loadUsers(): Promise<void> {
  const requestId = ++userListRequestId;
  loading.value = true;
  try {
    const result = await userApi.list({
      keyword: keyword.value.trim() || undefined,
      orgId: filterOrgId.value !== '0' ? Number(filterOrgId.value) : undefined,
      includeSub: includeSub.value,
      status: filterStatus.value === 'all' ? undefined : filterStatus.value,
      page: page.value,
      pageSize,
    });
    if (requestId !== userListRequestId) {
      return;
    }
    const maxPage = Math.max(1, Math.ceil(result.total / pageSize));
    if (page.value > maxPage) {
      page.value = maxPage;
      await loadUsers();
      return;
    }
    users.value = result.list;
    total.value = result.total;
  } catch (error) {
    if (requestId !== userListRequestId) {
      return;
    }
    users.value = [];
    total.value = 0;
    toast.error(error instanceof Error ? error.message : '用户列表加载失败');
  } finally {
    if (requestId === userListRequestId) {
      loading.value = false;
    }
  }
}

function applyFilters(): void {
  page.value = 1;
  void loadUsers();
}

function resetFilters(): void {
  keyword.value = '';
  filterOrgId.value = '0';
  filterStatus.value = 'all';
  includeSub.value = true;
  page.value = 1;
  void loadUsers();
}

function changePage(nextPage: number): void {
  page.value = nextPage;
  void loadUsers();
}

async function refreshAll(): Promise<void> {
  postOptionsLoaded.value = false;
  await Promise.all([loadOrgTree(), loadRoles(), loadUsers()]);
  toast.success('用户数据已刷新');
}

/* ==================== 表单数据加载 ==================== */
const postOptions = ref<MultiSelectOption[]>([]);
const postOptionsLoading = ref(false);
const postOptionsLoaded = ref(false);
let postOptionsPromise: Promise<void> | null = null;

/** 加载全部组织的岗位候选；同一页面生命周期内复用，刷新时失效重载。 */
function loadPostOptions(): Promise<void> {
  if (postOptionsLoaded.value) {
    return Promise.resolve();
  }
  if (postOptionsPromise) {
    return postOptionsPromise;
  }
  postOptionsPromise = (async () => {
    postOptionsLoading.value = true;
    postOptions.value = [];
    try {
      // 组织树可能仍在加载：先等待，避免用空树直接判定为“没有岗位”
      if (!orgTree.value.length) {
        await loadOrgTree();
      }
      const orgs = flattenOrgTree(orgTree.value);
      const groups = await Promise.all(
        orgs.map(async (orgRow) => {
          const tree = await postApi.list(orgRow.org.orgId);
          return flattenPostTree(tree).map((row) => ({
            value: row.post.postId,
            label: row.post.postName,
            group: orgRow.path,
            hint: `${row.post.headcount} 人`,
          }));
        }),
      );
      postOptions.value = groups.flat();
      postOptionsLoaded.value = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '岗位候选加载失败');
    } finally {
      postOptionsLoading.value = false;
      postOptionsPromise = null;
    }
  })();
  return postOptionsPromise;
}

/* ==================== 新增 / 编辑用户 ==================== */
const userFormOpen = ref(false);
const userEditTarget = ref<UserListItem | null>(null);
const userSaving = ref(false);
const userError = ref('');

function openCreateUser(): void {
  userEditTarget.value = null;
  userError.value = '';
  userFormOpen.value = true;
  void loadPostOptions();
}

function openEditUser(user: UserListItem): void {
  userEditTarget.value = user;
  userError.value = '';
  userFormOpen.value = true;
  void loadPostOptions();
}

async function handleUserSubmit(payload: {
  userId?: number;
  userName: string;
  nickName: string;
  password?: string;
  email: string;
  phonenumber: string;
  sex: '0' | '1' | '2';
  status: Status;
  postIds: number[];
  roleIds: number[];
}): Promise<void> {
  userSaving.value = true;
  userError.value = '';
  try {
    if (payload.userId) {
      await userApi.update(payload.userId, {
        nickName: payload.nickName,
        email: payload.email,
        phonenumber: payload.phonenumber,
        sex: payload.sex,
        status: payload.status,
        postIds: payload.postIds,
        roleIds: payload.roleIds,
      });
      toast.success('用户信息已更新');
    } else {
      await userApi.create({
        userName: payload.userName,
        nickName: payload.nickName,
        password: payload.password,
        email: payload.email,
        phonenumber: payload.phonenumber,
        sex: payload.sex,
        status: payload.status,
        postIds: payload.postIds,
        roleIds: payload.roleIds,
      });
      toast.success('用户创建成功');
    }
    userFormOpen.value = false;
    // 岗位在岗人数会随用户变化，下一次打开表单时重新加载候选
    postOptionsLoaded.value = false;
    await loadUsers();
  } catch (error) {
    userError.value = error instanceof Error ? error.message : '用户保存失败';
  } finally {
    userSaving.value = false;
  }
}

/* ==================== 分配角色 ==================== */
const rolesDialogOpen = ref(false);
const rolesTarget = ref<UserListItem | null>(null);
const rolesSaving = ref(false);
const rolesError = ref('');

function openUserRoles(user: UserListItem): void {
  rolesTarget.value = user;
  rolesError.value = '';
  rolesDialogOpen.value = true;
}

async function handleAssignRoles(roleIds: number[]): Promise<void> {
  if (!rolesTarget.value) {
    return;
  }
  rolesSaving.value = true;
  rolesError.value = '';
  try {
    await userApi.assignRoles(rolesTarget.value.userId, { roleIds });
    toast.success('用户角色已更新');
    rolesDialogOpen.value = false;
    await loadUsers();
  } catch (error) {
    rolesError.value = error instanceof Error ? error.message : '角色分配失败';
  } finally {
    rolesSaving.value = false;
  }
}

/* ==================== 重置密码 ==================== */
const passwordOpen = ref(false);
const passwordTarget = ref<UserListItem | null>(null);
const passwordSaving = ref(false);
const passwordError = ref('');

function openResetPassword(user: UserListItem): void {
  passwordTarget.value = user;
  passwordError.value = '';
  passwordOpen.value = true;
}

async function handleResetPassword(password: string): Promise<void> {
  if (!passwordTarget.value || passwordSaving.value) {
    return;
  }
  passwordSaving.value = true;
  passwordError.value = '';
  try {
    await userApi.resetPassword(passwordTarget.value.userId, { password });
    toast.success('密码已重置');
    passwordOpen.value = false;
  } catch (error) {
    passwordError.value = error instanceof Error ? error.message : '密码重置失败';
  } finally {
    passwordSaving.value = false;
  }
}

/* ==================== 查看权限 ==================== */
const permissionOpen = ref(false);
const permissionTarget = ref<UserListItem | null>(null);

function openPermissions(user: UserListItem): void {
  permissionTarget.value = user;
  permissionOpen.value = true;
}

/* ==================== 删除用户 ==================== */
const deleteOpen = ref(false);
const deleteTarget = ref<UserListItem | null>(null);
const deleting = ref(false);

function askDeleteUser(user: UserListItem): void {
  deleteTarget.value = user;
  deleteOpen.value = true;
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return;
  }
  deleting.value = true;
  try {
    await userApi.remove(deleteTarget.value.userId);
    toast.success('用户已删除');
    deleteOpen.value = false;
    postOptionsLoaded.value = false;
    await loadUsers();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '删除用户失败');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadOrgTree(), loadRoles(), loadUsers()]);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <PageHeader title="用户管理" description="用户通过岗位获得组织归属，可同时持有跨组织的多个岗位与多个角色。">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" @click="refreshAll">
          <RefreshCw class="size-4" :class="loading && 'animate-spin'" />
          刷新
        </Button>
        <Button v-if="auth.hasPerm(PERMS.USER_ADD)" size="sm" @click="openCreateUser">
          <Plus class="size-4" />
          新增用户
        </Button>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <div class="space-y-1">
        <label for="user-filter-keyword" class="text-[11px] text-muted-foreground">关键词</label>
        <div class="relative">
          <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="user-filter-keyword"
            v-model="keyword"
            placeholder="账号 / 昵称 / 手机号"
            class="h-9 w-52 rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            @keyup.enter="applyFilters"
          />
        </div>
      </div>

      <div class="w-48 space-y-1">
        <label for="user-filter-org" class="text-[11px] text-muted-foreground">组织</label>
        <Select v-model="filterOrgId">
          <SelectTrigger id="user-filter-org" class="h-9 w-full">
            <SelectValue placeholder="全部组织" />
          </SelectTrigger>
          <SelectContent class="max-h-72">
            <SelectItem value="0">全部组织</SelectItem>
            <SelectItem
              v-for="row in orgRows"
              :key="row.org.orgId"
              :value="String(row.org.orgId)"
            >
              {{ String.fromCharCode(0x3000).repeat(row.level) }}{{ row.org.orgName }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="w-32 space-y-1">
        <label for="user-filter-status" class="text-[11px] text-muted-foreground">状态</label>
        <Select v-model="filterStatus">
          <SelectTrigger id="user-filter-status" class="h-9 w-full">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="0">正常</SelectItem>
            <SelectItem value="1">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex h-9 items-center gap-2 pb-0.5">
        <Switch
          v-model="includeSub"
          aria-label="包含下级组织"
          :disabled="filterOrgId === '0'"
        />
        <span class="text-xs text-muted-foreground">含下级组织</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" @click="resetFilters">重置</Button>
        <Button size="sm" :disabled="loading" @click="applyFilters">
          <Loader2 v-if="loading" class="size-3.5 animate-spin" />
          <Search v-else class="size-3.5" />
          查询
        </Button>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="min-w-48 pl-4">用户</TableHead>
              <TableHead class="min-w-52">任职岗位</TableHead>
              <TableHead class="min-w-40">直接角色</TableHead>
              <TableHead class="min-w-36">直授权限</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="pr-4 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="6">
                <div class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  正在加载用户…
                </div>
              </TableCell>
            </TableRow>
            <template v-else-if="users.length">
              <TableRow v-for="user in users" :key="user.userId">
                <TableCell class="pl-4">
                  <div class="flex items-center gap-2.5">
                    <span
                      class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                    >
                      {{ user.nickName.slice(0, 1) }}
                    </span>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">{{ user.nickName }}</p>
                      <p class="truncate font-mono text-[11px] text-muted-foreground">
                        {{ user.userName }} · {{ user.phonenumber || '未填写手机' }}
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
                      class="max-w-44"
                      :title="`${post.orgPath} / ${post.postName}`"
                    >
                      <span class="truncate">{{ post.postName }}</span>
                      <span class="ml-1 shrink-0 text-[10px] font-normal text-muted-foreground">
                        {{ post.orgName }}
                      </span>
                    </Badge>
                    <Badge v-if="user.posts.length > 2" variant="muted">
                      +{{ user.posts.length - 2 }}
                    </Badge>
                    <span v-if="!user.posts.length" class="text-xs text-muted-foreground">未分配</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge
                      v-for="role in user.roles.slice(0, 2)"
                      :key="role.roleId"
                      variant="secondary"
                      :title="`${role.roleKey} · ${DATA_SCOPE_LABELS[role.dataScope]}`"
                    >
                      {{ role.roleName }}
                    </Badge>
                    <Badge v-if="user.roles.length > 2" variant="muted">
                      +{{ user.roles.length - 2 }}
                    </Badge>
                    <span v-if="!user.roles.length" class="text-xs text-muted-foreground">无角色</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span class="text-xs text-muted-foreground">
                    岗位 {{ user.postPermCount }} 项 / 组织 {{ user.orgPermCount }} 项
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge :status="user.status" />
                </TableCell>
                <TableCell class="pr-4 text-right">
                  <div class="flex items-center justify-end gap-0.5">
                    <Button
                      v-if="auth.hasPerm(PERMS.USER_EDIT)"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      title="编辑用户"
                      @click="openEditUser(user)"
                    >
                      <Pencil class="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-8"
                          title="更多操作"
                        >
                          <MoreHorizontal class="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-44">
                        <DropdownMenuItem
                          v-if="auth.hasPerm(PERMS.USER_VIEW)"
                          @select="openPermissions(user)"
                        >
                          <Eye class="size-4" />
                          查看权限
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="auth.hasPerm(PERMS.USER_AUTH_ROLE)"
                          @select="openUserRoles(user)"
                        >
                          <ShieldCheck class="size-4" />
                          分配角色
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="auth.hasPerm(PERMS.USER_RESET_PWD)"
                          @select="openResetPassword(user)"
                        >
                          <KeyRound class="size-4" />
                          重置密码
                        </DropdownMenuItem>
                        <DropdownMenuSeparator
                          v-if="auth.hasPerm(PERMS.USER_REMOVE)"
                        />
                        <DropdownMenuItem
                          v-if="auth.hasPerm(PERMS.USER_REMOVE)"
                          variant="destructive"
                          @select="askDeleteUser(user)"
                        >
                          <Trash2 class="size-4" />
                          删除用户
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell colspan="6">
                <EmptyState text="没有匹配的用户记录">
                  <Button
                    v-if="auth.hasPerm(PERMS.USER_ADD)"
                    size="sm"
                    @click="openCreateUser"
                  >
                    <UserRound class="size-4" />
                    新增第一个用户
                  </Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="border-t px-4 py-2">
        <Pagination
          :page="page"
          :total="total"
          :page-size="pageSize"
          :disabled="loading"
          @change="changePage"
        />
      </div>
    </div>

    <UserFormDialog
      v-model:open="userFormOpen"
      :user="userEditTarget"
      :post-options="postOptions"
      :post-options-loading="postOptionsLoading"
      :role-options="roleOptions"
      :saving="userSaving"
      :error="userError"
      @submit="handleUserSubmit"
    />

    <UserRolesDialog
      v-model:open="rolesDialogOpen"
      :user="rolesTarget"
      :roles="roles"
      :saving="rolesSaving"
      :error="rolesError"
      @submit="handleAssignRoles"
    />

    <ResetPasswordDialog
      v-model:open="passwordOpen"
      :user-name="passwordTarget?.userName ?? ''"
      :saving="passwordSaving"
      :error="passwordError"
      @submit="handleResetPassword"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="删除用户"
      :description="`确认删除用户「${deleteTarget?.nickName ?? ''}」？该用户持有的岗位与角色关联会一并清理。`"
      confirm-text="删除"
      destructive
      :loading="deleting"
      @confirm="handleDelete"
    />

    <UserPermissionDialog
      v-model:open="permissionOpen"
      :user-id="permissionTarget?.userId ?? null"
      :user-name="permissionTarget?.userName ?? ''"
      :nick-name="permissionTarget?.nickName ?? ''"
      :orgs="orgTree"
    />
  </div>
</template>
