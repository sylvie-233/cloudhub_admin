<script setup lang="ts">
import type { Org, OrgTreeNode, OrgUserItem, PostTreeNode } from '@cloudhub/types';
import { PERMS } from '@cloudhub/types';
import {
  Badge,
  Button,
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
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';

import { orgApi, postApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import Pagination from '@/components/common/Pagination.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LeaderDialog from '@/components/org/LeaderDialog.vue';
import OrgFormDialog from '@/components/org/OrgFormDialog.vue';
import PostFormDialog from '@/components/org/PostFormDialog.vue';
import type { PostParentOption } from '@/components/org/types';
import UserPermissionDialog from '@/components/user/UserPermissionDialog.vue';
import { useAuthStore } from '@/stores/auth';
import {
  collectPostIds,
  flattenOrgTree,
  flattenPostTree,
} from '@/utils/format';

const auth = useAuthStore();

/* ==================== 组织树 ==================== */
const orgTree = ref<OrgTreeNode[]>([]);
const orgsLoading = ref(false);
const selectedOrgId = ref(0);
const orgKeyword = ref('');
const collapsedOrgs = ref<Set<number>>(new Set());

const flatOrgs = computed(() => flattenOrgTree(orgTree.value));

const visibleOrgRows = computed(() => {
  const lowered = orgKeyword.value.trim().toLowerCase();
  if (!lowered) {
    return flattenOrgTree(orgTree.value, collapsedOrgs.value);
  }
  const matchedIds = new Set<number>();
  for (const row of flatOrgs.value) {
    const haystack = `${row.org.orgName} ${row.org.orgCode} ${row.path}`.toLowerCase();
    if (haystack.includes(lowered)) {
      matchedIds.add(row.org.orgId);
      for (const ancestorId of row.org.ancestors.split(',')) {
        const parsed = Number(ancestorId);
        if (parsed > 0) {
          matchedIds.add(parsed);
        }
      }
    }
  }
  return flatOrgs.value.filter((row) => matchedIds.has(row.org.orgId));
});

function findOrg(nodes: OrgTreeNode[], orgId: number): OrgTreeNode | null {
  for (const node of nodes) {
    if (node.orgId === orgId) {
      return node;
    }
    const found = findOrg(node.children, orgId);
    if (found) {
      return found;
    }
  }
  return null;
}

const selectedOrg = computed(() => findOrg(orgTree.value, selectedOrgId.value));

function toggleOrgCollapse(orgId: number): void {
  const next = new Set(collapsedOrgs.value);
  if (next.has(orgId)) {
    next.delete(orgId);
  } else {
    next.add(orgId);
  }
  collapsedOrgs.value = next;
}

async function loadOrgTree(preferredId?: number): Promise<void> {
  orgsLoading.value = true;
  try {
    orgTree.value = await orgApi.list();
    const rows = flattenOrgTree(orgTree.value);
    const exists = rows.some((row) => row.org.orgId === selectedOrgId.value);
    const nextId = preferredId ?? (exists ? selectedOrgId.value : (rows[0]?.org.orgId ?? 0));
    const changed = nextId !== selectedOrgId.value;
    selectedOrgId.value = nextId;
    if (changed) {
      selectedPostId.value = 0;
      userPage.value = 1;
    }
    if (nextId > 0) {
      await Promise.all([loadPosts(), loadOrgUsers()]);
    } else {
      postTree.value = [];
      users.value = [];
      usersTotal.value = 0;
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '组织树加载失败');
  } finally {
    orgsLoading.value = false;
  }
}

function selectOrg(orgId: number): void {
  if (orgId === selectedOrgId.value) {
    return;
  }
  selectedOrgId.value = orgId;
  selectedPostId.value = 0;
  userKeyword.value = '';
  userPage.value = 1;
  void Promise.all([loadPosts(), loadOrgUsers()]);
}

/* ==================== 岗位树 ==================== */
const postTree = ref<PostTreeNode[]>([]);
const postsLoading = ref(false);
const selectedPostId = ref(0);
const collapsedPosts = ref<Set<number>>(new Set());

const visiblePostRows = computed(() =>
  flattenPostTree(postTree.value, collapsedPosts.value),
);

const selectedPost = computed(
  () => visiblePostRows.value.find((row) => row.post.postId === selectedPostId.value)?.post ?? null,
);

const leaderPostName = computed(() => {
  const leader = flattenPostTree(postTree.value).find((row) => row.post.isLeader);
  return leader?.post.postName ?? null;
});

function togglePostCollapse(postId: number): void {
  const next = new Set(collapsedPosts.value);
  if (next.has(postId)) {
    next.delete(postId);
  } else {
    next.add(postId);
  }
  collapsedPosts.value = next;
}

let postsRequestId = 0;

async function loadPosts(): Promise<void> {
  const orgId = selectedOrgId.value;
  if (!orgId) {
    postTree.value = [];
    return;
  }
  const requestId = ++postsRequestId;
  postsLoading.value = true;
  try {
    const tree = await postApi.list(orgId);
    if (requestId !== postsRequestId || orgId !== selectedOrgId.value) {
      return;
    }
    postTree.value = tree;
    const exists = flattenPostTree(postTree.value).some(
      (row) => row.post.postId === selectedPostId.value,
    );
    if (!exists) {
      selectedPostId.value = 0;
    }
  } catch (error) {
    if (requestId !== postsRequestId || orgId !== selectedOrgId.value) {
      return;
    }
    postTree.value = [];
    toast.error(error instanceof Error ? error.message : '岗位树加载失败');
  } finally {
    if (requestId === postsRequestId) {
      postsLoading.value = false;
    }
  }
}

function filterByPost(postId: number): void {
  selectedPostId.value = selectedPostId.value === postId ? 0 : postId;
  userKeyword.value = '';
  userPage.value = 1;
  void loadOrgUsers();
}

/* ==================== 在岗用户 ==================== */
const users = ref<OrgUserItem[]>([]);
const usersTotal = ref(0);
const userPage = ref(1);
const userPageSize = 10;
const usersLoading = ref(false);
const userKeyword = ref('');
const includeSub = ref(true);

const postFilterName = computed(() => selectedPost.value?.postName ?? '');

let usersRequestId = 0;

async function loadOrgUsers(): Promise<void> {
  const orgId = selectedOrgId.value;
  if (!orgId) {
    users.value = [];
    usersTotal.value = 0;
    return;
  }
  const requestId = ++usersRequestId;
  usersLoading.value = true;
  try {
    const result = await orgApi.users(orgId, {
      keyword: userKeyword.value.trim() || undefined,
      postId: selectedPostId.value || undefined,
      includeSub: includeSub.value,
      page: userPage.value,
      pageSize: userPageSize,
    });
    if (requestId !== usersRequestId || orgId !== selectedOrgId.value) {
      return;
    }
    const maxPage = Math.max(1, Math.ceil(result.total / userPageSize));
    if (userPage.value > maxPage) {
      userPage.value = maxPage;
      await loadOrgUsers();
      return;
    }
    users.value = result.list;
    usersTotal.value = result.total;
  } catch (error) {
    if (requestId !== usersRequestId || orgId !== selectedOrgId.value) {
      return;
    }
    users.value = [];
    usersTotal.value = 0;
    toast.error(error instanceof Error ? error.message : '在岗用户加载失败');
  } finally {
    if (requestId === usersRequestId) {
      usersLoading.value = false;
    }
  }
}

function applyUserFilter(): void {
  userPage.value = 1;
  void loadOrgUsers();
}

function clearUserFilter(): void {
  userKeyword.value = '';
  selectedPostId.value = 0;
  userPage.value = 1;
  void loadOrgUsers();
}

function handleIncludeSubChange(): void {
  userPage.value = 1;
  void loadOrgUsers();
}

function changeUserPage(page: number): void {
  userPage.value = page;
  void loadOrgUsers();
}

function clearPostFilter(): void {
  selectedPostId.value = 0;
  userPage.value = 1;
  void loadOrgUsers();
}

/* ==================== 组织表单 ==================== */
const orgFormOpen = ref(false);
const orgEditTarget = ref<Org | null>(null);
const orgDefaultParentId = ref<number | null>(null);
const orgSaving = ref(false);
const orgError = ref('');

function openCreateOrg(parentId: number | null = null): void {
  orgEditTarget.value = null;
  orgDefaultParentId.value = parentId;
  orgError.value = '';
  orgFormOpen.value = true;
}

function openEditOrg(): void {
  if (!selectedOrg.value) {
    return;
  }
  orgEditTarget.value = selectedOrg.value;
  orgDefaultParentId.value = null;
  orgError.value = '';
  orgFormOpen.value = true;
}

async function handleOrgSubmit(payload: {
  orgId?: number;
  parentId: number;
  orgName: string;
  orgCode?: string;
  orderNum?: number;
  status: '0' | '1';
}): Promise<void> {
  orgSaving.value = true;
  orgError.value = '';
  try {
    const input = {
      parentId: payload.parentId,
      orgName: payload.orgName,
      ...(payload.orgCode ? { orgCode: payload.orgCode } : {}),
      orderNum: payload.orderNum ?? 0,
      status: payload.status,
    };
    if (payload.orgId) {
      const updated = await orgApi.update(payload.orgId, input);
      toast.success('组织信息已更新');
      orgFormOpen.value = false;
      await loadOrgTree(updated.orgId);
    } else {
      const created = await orgApi.create(input);
      toast.success('组织创建成功');
      orgFormOpen.value = false;
      await loadOrgTree(created.orgId);
    }
  } catch (error) {
    orgError.value = error instanceof Error ? error.message : '组织保存失败';
  } finally {
    orgSaving.value = false;
  }
}

/* ==================== 岗位表单 ==================== */
const postFormOpen = ref(false);
const postEditTarget = ref<PostTreeNode | null>(null);
const postParentOptions = ref<PostParentOption[]>([]);
const postSaving = ref(false);
const postError = ref('');

async function loadPostParentOptions(target: PostTreeNode | null): Promise<void> {
  const excluded = target ? new Set(collectPostIds(target)) : new Set<number>();
  try {
    const orgRows = flattenOrgTree(orgTree.value);
    const groups = await Promise.all(
      orgRows.map(async (orgRow) => {
        const tree = await postApi.list(orgRow.org.orgId);
        return flattenPostTree(tree)
          .filter((row) => !excluded.has(row.post.postId))
          .map((row) => ({
            value: row.post.postId,
            label: `${orgRow.path} · ${'　'.repeat(row.level)}${row.post.postName}`,
          }));
      }),
    );
    postParentOptions.value = groups.flat();
  } catch {
    postParentOptions.value = [];
    toast.error('跨组织岗位候选加载失败，请稍后重试');
  }
}

function openPostForm(post: PostTreeNode | null): void {
  if (!selectedOrgId.value) {
    return;
  }
  postEditTarget.value = post;
  postError.value = '';
  postParentOptions.value = [];
  postFormOpen.value = true;
  void loadPostParentOptions(post);
}

async function handlePostSubmit(payload: {
  postId?: number;
  orgId: number;
  parentId: number;
  postName: string;
  postCode?: string;
  postSort: number;
  status: '0' | '1';
  isLeader: boolean;
}): Promise<void> {
  postSaving.value = true;
  postError.value = '';
  try {
    const input = {
      orgId: payload.orgId,
      parentId: payload.parentId,
      postName: payload.postName,
      ...(payload.postCode ? { postCode: payload.postCode } : {}),
      postSort: payload.postSort,
      status: payload.status,
      isLeader: payload.isLeader,
    };
    if (payload.postId) {
      await postApi.update(payload.postId, input);
      toast.success('岗位信息已更新');
    } else {
      await postApi.create(input);
      toast.success('岗位创建成功');
    }
    postFormOpen.value = false;
    await loadPosts();
  } catch (error) {
    postError.value = error instanceof Error ? error.message : '岗位保存失败';
  } finally {
    postSaving.value = false;
  }
}

/* ==================== 责任岗位 ==================== */
const leaderOpen = ref(false);
const leaderSaving = ref(false);
const leaderError = ref('');

function openLeaderDialog(): void {
  leaderError.value = '';
  leaderOpen.value = true;
}

async function handleLeaderSubmit(postId: number | null): Promise<void> {
  if (!selectedOrgId.value) {
    return;
  }
  leaderSaving.value = true;
  leaderError.value = '';
  try {
    await orgApi.setLeader(selectedOrgId.value, postId);
    toast.success(postId ? '责任岗位已设置' : '责任岗位已清空');
    leaderOpen.value = false;
    await loadPosts();
  } catch (error) {
    leaderError.value = error instanceof Error ? error.message : '责任岗位保存失败';
  } finally {
    leaderSaving.value = false;
  }
}

/* ==================== 删除确认 ==================== */
const deleteOpen = ref(false);
const deleting = ref(false);
const deleteTarget = ref<{ type: 'org' | 'post'; id: number; name: string } | null>(null);

const deleteTitle = computed(() =>
  deleteTarget.value?.type === 'org' ? '删除组织' : '删除岗位',
);
const deleteDescription = computed(() => {
  if (deleteTarget.value?.type === 'org') {
    return `确认删除组织「${deleteTarget.value.name}」？存在子组织或岗位时无法删除。`;
  }
  return `确认删除岗位「${deleteTarget.value?.name ?? ''}」？仍有在岗人员时无法删除。`;
});

function askDeleteOrg(org: OrgTreeNode): void {
  deleteTarget.value = { type: 'org', id: org.orgId, name: org.orgName };
  deleteOpen.value = true;
}

function askDeletePost(post: PostTreeNode): void {
  deleteTarget.value = { type: 'post', id: post.postId, name: post.postName };
  deleteOpen.value = true;
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return;
  }
  deleting.value = true;
  try {
    if (deleteTarget.value.type === 'org') {
      await orgApi.remove(deleteTarget.value.id);
      toast.success('组织已删除');
      deleteOpen.value = false;
      selectedOrgId.value = 0;
      await loadOrgTree();
    } else {
      await postApi.remove(deleteTarget.value.id);
      toast.success('岗位已删除');
      deleteOpen.value = false;
      await Promise.all([loadPosts(), loadOrgUsers()]);
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '删除失败');
  } finally {
    deleting.value = false;
  }
}

/* ==================== 用户权限查看 ==================== */
const permissionOpen = ref(false);
const permissionUser = ref<OrgUserItem | null>(null);

function openUserPermission(user: OrgUserItem): void {
  permissionUser.value = user;
  permissionOpen.value = true;
}

async function refreshAll(): Promise<void> {
  await loadOrgTree();
  toast.success('组织与岗位数据已刷新');
}

onMounted(() => {
  void loadOrgTree();
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <PageHeader title="组织管理" description="维护组织树、岗位汇报线与责任岗位，查看各组织在岗人员。">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="orgsLoading" @click="refreshAll">
          <RefreshCw class="size-4" :class="orgsLoading && 'animate-spin'" />
          刷新
        </Button>
        <Button
          v-if="auth.hasPerm(PERMS.ORG_ADD)"
          size="sm"
          @click="openCreateOrg(null)"
        >
          <Plus class="size-4" />
          新增组织
        </Button>
      </template>
    </PageHeader>

    <div class="grid min-h-[36rem] gap-3 xl:grid-cols-[17rem_17rem_minmax(0,1fr)]">
      <!-- 组织树 -->
      <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div class="flex items-center gap-2">
            <Building2 class="size-4 text-primary" />
            <span class="text-sm font-semibold">组织结构</span>
            <Badge variant="muted">{{ flatOrgs.length }}</Badge>
          </div>
          <div class="flex items-center">
            <button
              v-if="auth.hasPerm(PERMS.ORG_ADD) && selectedOrg"
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="新增下级组织"
              @click="openCreateOrg(selectedOrgId)"
            >
              <Plus class="size-3.5" />
            </button>
            <button
              v-if="auth.hasPerm(PERMS.ORG_EDIT) && selectedOrg"
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="编辑当前组织"
              @click="openEditOrg"
            >
              <Pencil class="size-3.5" />
            </button>
            <button
              v-if="auth.hasPerm(PERMS.ORG_REMOVE) && selectedOrg"
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="删除当前组织"
              @click="askDeleteOrg(selectedOrg)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>

        <div class="border-b p-2">
          <div class="relative">
            <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="orgKeyword"
              aria-label="搜索组织名称或编码"
              placeholder="搜索组织名称或编码"
              class="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <div v-if="orgsLoading" class="space-y-1.5 p-1">
            <div v-for="index in 10" :key="index" class="h-9 animate-pulse rounded-md bg-muted" />
          </div>
          <template v-else-if="visibleOrgRows.length">
            <div
              v-for="row in visibleOrgRows"
              :key="row.org.orgId"
              role="treeitem"
              :aria-selected="row.org.orgId === selectedOrgId"
              tabindex="0"
              class="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              :class="
                row.org.orgId === selectedOrgId
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'hover:bg-muted/60'
              "
              :style="{ paddingLeft: `${Math.min(row.level, 8) * 14 + 6}px` }"
              @click="selectOrg(row.org.orgId)"
              @keydown.enter.self.prevent="selectOrg(row.org.orgId)"
              @keydown.space.self.prevent="selectOrg(row.org.orgId)"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="flex size-5 shrink-0 items-center justify-center rounded hover:bg-background/60"
                @click.stop="toggleOrgCollapse(row.org.orgId)"
              >
                <ChevronRight v-if="collapsedOrgs.has(row.org.orgId)" class="size-3.5" />
                <ChevronDown v-else class="size-3.5" />
              </button>
              <span v-else class="size-5 shrink-0" />
              <Building2 class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">{{ row.org.orgName }}</span>
              <Star
                v-if="row.org.leaderPostId"
                class="size-3 shrink-0 fill-amber-400 text-amber-500"
                title="已设置责任岗位"
              />
              <span class="shrink-0 text-[10px] text-muted-foreground">{{ row.org.postCount }}</span>
            </div>
          </template>
          <EmptyState v-else compact text="没有匹配的组织" />
        </div>
      </div>

      <!-- 岗位汇报线 -->
      <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <Users class="size-4 text-primary" />
            <span class="shrink-0 text-sm font-semibold">岗位汇报线</span>
          </div>
          <div class="flex items-center">
            <button
              v-if="auth.hasPerm(PERMS.ORG_SET_LEADER) && selectedOrg"
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="设置责任岗位"
              @click="openLeaderDialog"
            >
              <Star class="size-3.5" />
            </button>
            <button
              v-if="auth.hasPerm(PERMS.POST_ADD) && selectedOrg"
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="新增岗位"
              @click="openPostForm(null)"
            >
              <Plus class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="刷新岗位"
              :disabled="postsLoading || !selectedOrg"
              @click="loadPosts"
            >
              <RefreshCw class="size-3.5" :class="postsLoading && 'animate-spin'" />
            </button>
          </div>
        </div>

        <div v-if="selectedOrg" class="border-b px-3 py-2">
          <p class="truncate text-xs text-muted-foreground">
            {{ selectedOrg.orgName }}
          </p>
          <p class="mt-0.5 truncate text-[11px] text-muted-foreground">
            责任岗位：{{ leaderPostName ?? '未设置' }}
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <div v-if="postsLoading" class="space-y-1.5 p-1">
            <div v-for="index in 8" :key="index" class="h-9 animate-pulse rounded-md bg-muted" />
          </div>
          <template v-else-if="visiblePostRows.length">
            <div
              v-for="row in visiblePostRows"
              :key="row.post.postId"
              role="treeitem"
              :aria-selected="row.post.postId === selectedPostId"
              tabindex="0"
              class="group flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              :class="
                row.post.postId === selectedPostId
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'hover:bg-muted/60'
              "
              :style="{ paddingLeft: `${Math.min(row.level, 8) * 14 + 6}px` }"
              @click="filterByPost(row.post.postId)"
              @keydown.enter.self.prevent="filterByPost(row.post.postId)"
              @keydown.space.self.prevent="filterByPost(row.post.postId)"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="flex size-5 shrink-0 items-center justify-center rounded hover:bg-background/60"
                @click.stop="togglePostCollapse(row.post.postId)"
              >
                <ChevronRight v-if="collapsedPosts.has(row.post.postId)" class="size-3.5" />
                <ChevronDown v-else class="size-3.5" />
              </button>
              <span v-else class="size-5 shrink-0" />
              <span
                class="min-w-0 flex-1 truncate"
                :class="row.post.status === '1' && 'text-muted-foreground line-through'"
              >
                {{ row.post.postName }}
              </span>
              <Star
                v-if="row.post.isLeader"
                class="size-3 shrink-0 fill-amber-400 text-amber-500"
                title="责任岗位"
              />
              <span class="shrink-0 text-[10px] text-muted-foreground">{{ row.post.headcount }} 人</span>
              <div
                v-if="auth.hasPerm([PERMS.POST_EDIT, PERMS.POST_REMOVE])"
                class="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <button
                  v-if="auth.hasPerm(PERMS.POST_EDIT)"
                  type="button"
                  class="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  title="编辑岗位"
                  @click.stop="openPostForm(row.post)"
                >
                  <Pencil class="size-3" />
                </button>
                <button
                  v-if="auth.hasPerm(PERMS.POST_REMOVE)"
                  type="button"
                  class="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="删除岗位"
                  @click.stop="askDeletePost(row.post)"
                >
                  <Trash2 class="size-3" />
                </button>
              </div>
            </div>
          </template>
          <EmptyState
            v-else
            compact
            :text="selectedOrg ? '该组织暂无岗位' : '请先选择组织'"
          />
        </div>
      </div>

      <!-- 在岗用户 -->
      <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <Users class="size-4 text-primary" />
            <span class="text-sm font-semibold">在岗用户</span>
            <Badge variant="muted">{{ usersTotal }}</Badge>
          </div>
          <span v-if="selectedOrg" class="truncate text-xs text-muted-foreground">
            {{ selectedOrg.orgName }}
          </span>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-muted-foreground">含下级</span>
            <Switch v-model="includeSub" @update:model-value="handleIncludeSubChange" />
            <Button
              variant="ghost"
              size="sm"
              :disabled="usersLoading || !selectedOrg"
              @click="loadOrgUsers"
            >
              <RefreshCw class="size-3.5" :class="usersLoading && 'animate-spin'" />
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <form class="flex min-w-48 flex-1 items-center gap-1.5" @submit.prevent="applyUserFilter">
            <div class="relative flex-1">
              <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="userKeyword"
                aria-label="搜索在岗用户姓名、账号或手机号"
                placeholder="搜索姓名、账号或手机号"
                class="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" :disabled="!selectedOrg">
              查询
            </Button>
          </form>
          <Badge v-if="selectedPostId" variant="secondary" class="gap-1">
            岗位：{{ postFilterName }}
            <button type="button" class="rounded p-0.5 hover:bg-background/50" @click="clearPostFilter">
              <X class="size-3" />
            </button>
          </Badge>
          <Button
            v-if="selectedPostId || userKeyword"
            variant="ghost"
            size="sm"
            @click="clearUserFilter"
          >
            清除筛选
          </Button>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="pl-4">用户</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead class="pr-4 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="usersLoading">
                <TableCell colspan="5">
                  <div class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 class="size-4 animate-spin" />
                    正在加载用户…
                  </div>
                </TableCell>
              </TableRow>
              <template v-else-if="users.length">
                <TableRow v-for="user in users" :key="user.userId">
                  <TableCell class="pl-4">
                    <div class="flex items-center gap-2">
                      <span
                        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                      >
                        {{ user.nickName.slice(0, 1) }}
                      </span>
                      <div class="min-w-0">
                        <p class="truncate text-sm font-medium">{{ user.nickName }}</p>
                        <p class="truncate font-mono text-[11px] text-muted-foreground">
                          {{ user.userName }}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="min-w-48">
                    <div class="flex flex-wrap gap-1">
                      <Badge
                        v-for="post in user.posts.slice(0, 2)"
                        :key="post.postId"
                        variant="outline"
                        class="max-w-36"
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
                  <TableCell>
                    <StatusBadge :status="user.status" />
                  </TableCell>
                  <TableCell class="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="openUserPermission(user)"
                    >
                      <Eye class="size-3.5" />
                      权限
                    </Button>
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell colspan="5">
                  <EmptyState compact :text="selectedOrg ? '当前筛选条件下没有在岗用户' : '请先选择组织'" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div class="border-t px-3 py-2">
          <Pagination
            :page="userPage"
            :total="usersTotal"
            :page-size="userPageSize"
            :disabled="usersLoading"
            @change="changeUserPage"
          />
        </div>
      </div>
    </div>

    <OrgFormDialog
      v-model:open="orgFormOpen"
      :org="orgEditTarget"
      :orgs="orgTree"
      :default-parent-id="orgDefaultParentId"
      :saving="orgSaving"
      :error="orgError"
      @submit="handleOrgSubmit"
    />

    <PostFormDialog
      v-model:open="postFormOpen"
      :post="postEditTarget"
      :org-id="selectedOrgId"
      :parent-options="postParentOptions"
      :saving="postSaving"
      :error="postError"
      @submit="handlePostSubmit"
    />

    <LeaderDialog
      v-model:open="leaderOpen"
      :org-name="selectedOrg?.orgName ?? ''"
      :posts="postTree"
      :current-leader-id="selectedOrg?.leaderPostId ?? null"
      :saving="leaderSaving"
      :error="leaderError"
      @submit="handleLeaderSubmit"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="deleteTitle"
      :description="deleteDescription"
      confirm-text="删除"
      destructive
      :loading="deleting"
      @confirm="handleDelete"
    />

    <UserPermissionDialog
      v-model:open="permissionOpen"
      :user-id="permissionUser?.userId ?? null"
      :user-name="permissionUser?.userName ?? ''"
      :nick-name="permissionUser?.nickName ?? ''"
      :orgs="orgTree"
    />
  </div>
</template>
