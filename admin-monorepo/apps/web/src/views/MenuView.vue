<script setup lang="ts">
import type { Menu, MenuQuery, MenuRow, MenuTreeNode, MenuType, Status } from '@cloudhub/types';
import { MENU_TYPE_LABELS, PERMS } from '@cloudhub/types';
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
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';

import { menuApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import MenuFormDialog from '@/components/menu/MenuFormDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { resolveMenuIcon } from '@/utils/icons';

const auth = useAuthStore();

const rows = ref<MenuRow[]>([]);
const menuTree = ref<MenuTreeNode[]>([]);
const loading = ref(false);
const collapsed = ref<Set<number>>(new Set());

const keyword = ref('');
const filterType = ref<'all' | MenuType>('all');
const filterStatus = ref<'all' | Status>('all');

const isFiltering = computed(
  () =>
    Boolean(keyword.value.trim()) ||
    filterType.value !== 'all' ||
    filterStatus.value !== 'all',
);

const baseRows = computed(() => {
  if (filterStatus.value === 'all') {
    return rows.value;
  }
  const parentMap = new Map(rows.value.map((row) => [row.menuId, row.parentId]));
  const matched = new Set<number>();
  for (const row of rows.value) {
    if (row.status !== filterStatus.value) {
      continue;
    }
    matched.add(row.menuId);
    let parentId = parentMap.get(row.menuId) ?? 0;
    const visited = new Set<number>();
    while (parentId > 0 && !visited.has(parentId)) {
      visited.add(parentId);
      matched.add(parentId);
      parentId = parentMap.get(parentId) ?? 0;
    }
  }
  return rows.value.filter((row) => matched.has(row.menuId));
});

const visibleRows = computed(() => {
  if (isFiltering.value) {
    return baseRows.value;
  }
  const result: MenuRow[] = [];
  let hiddenLevel = Number.POSITIVE_INFINITY;
  for (const row of baseRows.value) {
    if (row.level >= hiddenLevel) {
      continue;
    }
    hiddenLevel = Number.POSITIVE_INFINITY;
    if (row.hasChild && collapsed.value.has(row.menuId)) {
      hiddenLevel = row.level + 1;
    }
    result.push(row);
  }
  return result;
});

let listRequestId = 0;

async function fetchMenus(): Promise<void> {
  const requestId = ++listRequestId;
  loading.value = true;
  try {
    const query: MenuQuery = {
      keyword: keyword.value.trim() || undefined,
      menuType: filterType.value === 'all' ? undefined : filterType.value,
    };
    const result = await menuApi.list(query);
    if (requestId !== listRequestId) {
      return;
    }
    rows.value = result;
  } catch (error) {
    if (requestId !== listRequestId) {
      return;
    }
    rows.value = [];
    toast.error(error instanceof Error ? error.message : '菜单列表加载失败');
  } finally {
    if (requestId === listRequestId) {
      loading.value = false;
    }
  }
}

async function loadMenuTree(): Promise<void> {
  try {
    menuTree.value = await menuApi.tree();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '菜单树加载失败');
  }
}

function applyFilters(): void {
  void fetchMenus();
}

function resetFilters(): void {
  keyword.value = '';
  filterType.value = 'all';
  filterStatus.value = 'all';
  void fetchMenus();
}

function toggleCollapse(menuId: number): void {
  const next = new Set(collapsed.value);
  if (next.has(menuId)) {
    next.delete(menuId);
  } else {
    next.add(menuId);
  }
  collapsed.value = next;
}

function rowIcon(row: MenuRow) {
  if (row.menuType === 'F') {
    return CircleDot;
  }
  return resolveMenuIcon(row.icon) ?? Folder;
}

async function refreshAll(): Promise<void> {
  await Promise.all([fetchMenus(), loadMenuTree()]);
  toast.success('菜单数据已刷新');
}

/* ==================== 新增 / 编辑 ==================== */
const formOpen = ref(false);
const editTarget = ref<Menu | null>(null);
const defaultParentId = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');

function openCreate(parentId: number | null = null): void {
  editTarget.value = null;
  defaultParentId.value = parentId;
  formError.value = '';
  formOpen.value = true;
  void loadMenuTree();
}

function openEdit(row: MenuRow): void {
  editTarget.value = row;
  defaultParentId.value = null;
  formError.value = '';
  formOpen.value = true;
  void loadMenuTree();
}

async function handleSubmit(payload: {
  menuId?: number;
  parentId: number;
  menuName: string;
  orderNum: number;
  path: string;
  component: string | null;
  menuType: MenuType;
  status: Status;
  perms: string | null;
  icon: string;
}): Promise<void> {
  saving.value = true;
  formError.value = '';
  try {
    const input = {
      parentId: payload.parentId,
      menuName: payload.menuName,
      orderNum: payload.orderNum,
      path: payload.path,
      component: payload.component,
      menuType: payload.menuType,
      status: payload.status,
      perms: payload.perms,
      icon: payload.icon,
    };
    if (payload.menuId) {
      await menuApi.update(payload.menuId, input);
      toast.success('菜单信息已更新');
    } else {
      await menuApi.create(input);
      toast.success('菜单创建成功，已默认授权给超级管理员');
    }
    formOpen.value = false;
    await Promise.all([fetchMenus(), loadMenuTree()]);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '菜单保存失败';
  } finally {
    saving.value = false;
  }
}

/* ==================== 删除 ==================== */
const deleteOpen = ref(false);
const deleteTarget = ref<Menu | null>(null);
const deleting = ref(false);

function askDelete(row: MenuRow): void {
  deleteTarget.value = row;
  deleteOpen.value = true;
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return;
  }
  deleting.value = true;
  try {
    await menuApi.remove(deleteTarget.value.menuId);
    toast.success('菜单已删除');
    deleteOpen.value = false;
    await Promise.all([fetchMenus(), loadMenuTree()]);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '删除菜单失败');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void Promise.all([fetchMenus(), loadMenuTree()]);
});
</script>

<template>
  <div class="mx-auto max-w-[1500px]">
    <PageHeader title="菜单管理" description="菜单分为目录 M、菜单 C、动作 F；动作行的权限标识即后端鉴权点。">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" @click="refreshAll">
          <RefreshCw class="size-4" :class="loading && 'animate-spin'" />
          刷新
        </Button>
        <Button v-if="auth.hasPerm(PERMS.MENU_ADD)" size="sm" @click="openCreate(null)">
          <Plus class="size-4" />
          新增菜单
        </Button>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <div class="space-y-1">
        <label for="menu-filter-keyword" class="text-[11px] text-muted-foreground">关键词</label>
        <div class="relative">
          <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="menu-filter-keyword"
            v-model="keyword"
            placeholder="菜单名称 / 权限标识"
            class="h-9 w-56 rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            @keyup.enter="applyFilters"
          />
        </div>
      </div>

      <div class="w-32 space-y-1">
        <label for="menu-filter-type" class="text-[11px] text-muted-foreground">类型</label>
        <Select v-model="filterType">
          <SelectTrigger id="menu-filter-type" class="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="M">目录</SelectItem>
            <SelectItem value="C">菜单</SelectItem>
            <SelectItem value="F">动作</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="w-32 space-y-1">
        <label for="menu-filter-status" class="text-[11px] text-muted-foreground">状态</label>
        <Select v-model="filterStatus">
          <SelectTrigger id="menu-filter-status" class="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="0">正常</SelectItem>
            <SelectItem value="1">停用</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead class="min-w-64 pl-4">菜单名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead class="min-w-36">路由 / 组件</TableHead>
              <TableHead class="min-w-44">权限标识</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="pr-4 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="7">
                <div class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  正在加载菜单…
                </div>
              </TableCell>
            </TableRow>
            <template v-else-if="visibleRows.length">
              <TableRow v-for="row in visibleRows" :key="row.menuId">
                <TableCell class="pl-4">
                  <div
                    class="flex items-center gap-1.5"
                    :style="{ paddingLeft: `${Math.min(row.level, 3) * 18}px` }"
                  >
                    <button
                      v-if="row.hasChild && !isFiltering"
                      type="button"
                      class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                      :title="collapsed.has(row.menuId) ? '展开下级' : '收起下级'"
                      @click="toggleCollapse(row.menuId)"
                    >
                      <ChevronRight v-if="collapsed.has(row.menuId)" class="size-3.5" />
                      <ChevronDown v-else class="size-3.5" />
                    </button>
                    <span v-else class="size-5 shrink-0" />
                    <span
                      class="flex size-5 shrink-0 items-center justify-center rounded"
                      :class="row.menuType === 'M' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
                    >
                      <component :is="rowIcon(row)" class="size-3.5" />
                    </span>
                    <span
                      class="truncate text-sm"
                      :class="[
                        row.menuType === 'M' && 'font-medium',
                        row.status === '1' && 'text-muted-foreground line-through',
                      ]"
                    >
                      {{ row.menuName }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    :variant="row.menuType === 'M' ? 'secondary' : row.menuType === 'F' ? 'outline' : 'muted'"
                  >
                    {{ MENU_TYPE_LABELS[row.menuType] }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p class="max-w-48 truncate font-mono text-xs text-muted-foreground" :title="row.path">
                    {{ row.path || '—' }}
                  </p>
                  <p
                    v-if="row.component"
                    class="max-w-48 truncate font-mono text-[11px] text-muted-foreground"
                    :title="row.component"
                  >
                    {{ row.component }}
                  </p>
                </TableCell>
                <TableCell>
                  <span
                    v-if="row.perms"
                    class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {{ row.perms }}
                  </span>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground">
                  {{ row.orderNum }}
                </TableCell>
                <TableCell>
                  <StatusBadge :status="row.status" />
                </TableCell>
                <TableCell class="pr-4">
                  <div class="flex items-center justify-end gap-0.5">
                    <Button
                      v-if="auth.hasPerm(PERMS.MENU_ADD) && row.menuType !== 'F'"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      title="新增下级菜单"
                      @click="openCreate(row.menuId)"
                    >
                      <Plus class="size-3.5" />
                    </Button>
                    <Button
                      v-if="auth.hasPerm(PERMS.MENU_EDIT)"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      title="编辑菜单"
                      @click="openEdit(row)"
                    >
                      <Pencil class="size-3.5" />
                    </Button>
                    <Button
                      v-if="auth.hasPerm(PERMS.MENU_REMOVE)"
                      variant="ghost"
                      size="icon"
                      class="size-8 text-muted-foreground hover:text-destructive"
                      title="删除菜单"
                      @click="askDelete(row)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell colspan="7">
                <EmptyState text="没有匹配的菜单">
                  <Button variant="ghost" size="sm" @click="resetFilters">重置筛选</Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <span>共 {{ visibleRows.length }} 个菜单节点；筛选状态下以平铺方式展示。</span>
        <span>菜单根 ID 1000，动作 ID 以 100xx 起。</span>
      </div>
    </div>

    <MenuFormDialog
      v-model:open="formOpen"
      :menu="editTarget"
      :menus="menuTree"
      :default-parent-id="defaultParentId"
      :saving="saving"
      :error="formError"
      @submit="handleSubmit"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="删除菜单"
      :description="`确认删除菜单「${deleteTarget?.menuName ?? ''}」？存在子菜单时需先删除下级。`"
      confirm-text="删除"
      destructive
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>
