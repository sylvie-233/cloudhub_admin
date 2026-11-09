<script setup lang="ts">
import type { MenuTreeNode } from '@cloudhub/types';
import { MENU_TYPE_LABELS } from '@cloudhub/types';
import { Badge, Button, Checkbox, cn } from '@cloudhub/ui';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  Lock,
  Search,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import EmptyState from '@/components/common/EmptyState.vue';
import { collectMenuIds, flattenMenuTree } from '@/utils/format';
import { resolveMenuIcon } from '@/utils/icons';

const props = withDefaults(
  defineProps<{
    menus: MenuTreeNode[];
    readonly?: boolean;
    locked?: boolean;
    loading?: boolean;
    emptyText?: string;
  }>(),
  {
    readonly: false,
    locked: false,
    loading: false,
    emptyText: '暂无可授权菜单',
  },
);

const selected = defineModel<number[]>({ default: () => [] });

const keyword = ref('');
const onlySelected = ref(false);
const collapsed = ref<Set<number>>(new Set());

const parentMap = computed(() => {
  const map = new Map<number, number>();
  const walk = (nodes: MenuTreeNode[]): void => {
    for (const node of nodes) {
      map.set(node.menuId, node.parentId);
      walk(node.children);
    }
  };
  walk(props.menus);
  return map;
});

const allNodeMap = computed(() => {
  const map = new Map<number, MenuTreeNode>();
  const walk = (nodes: MenuTreeNode[]): void => {
    for (const node of nodes) {
      map.set(node.menuId, node);
      walk(node.children);
    }
  };
  walk(props.menus);
  return map;
});

const selectedSet = computed(() => new Set(selected.value));

/** 搜索命中节点 + 其祖先 + 其子孙，保证上下文完整。 */
const visibleIds = computed<Set<number> | null>(() => {
  const lowered = keyword.value.trim().toLowerCase();
  if (!lowered && !onlySelected.value) {
    return null;
  }

  const matched = new Set<number>();
  if (lowered) {
    for (const node of allNodeMap.value.values()) {
      const haystack = [node.menuName, node.perms ?? '', node.path].join(' ').toLowerCase();
      if (haystack.includes(lowered)) {
        matched.add(node.menuId);
      }
    }
  }

  const ids = new Set<number>();
  const addNodeWithContext = (menuId: number): void => {
    const node = allNodeMap.value.get(menuId);
    if (!node) {
      return;
    }
    ids.add(menuId);
    for (const descendantId of collectMenuIds(node)) {
      ids.add(descendantId);
    }
    let parentId = parentMap.value.get(menuId) ?? 0;
    const visited = new Set<number>();
    while (parentId > 0 && !visited.has(parentId)) {
      visited.add(parentId);
      ids.add(parentId);
      parentId = parentMap.value.get(parentId) ?? 0;
    }
  };

  if (onlySelected.value) {
    for (const menuId of selected.value) {
      if (allNodeMap.value.has(menuId)) {
        addNodeWithContext(menuId);
      }
    }
  }
  if (lowered) {
    for (const menuId of matched) {
      addNodeWithContext(menuId);
    }
  }
  return ids;
});

const visibleRows = computed(() => {
  const ignoreCollapse = Boolean(keyword.value.trim()) || onlySelected.value;
  const rows = flattenMenuTree(props.menus, ignoreCollapse ? undefined : collapsed.value);
  return rows.filter((row) => !visibleIds.value || visibleIds.value.has(row.menu.menuId));
});

const selectableNodes = computed(() => [...allNodeMap.value.values()]);

const selectedLeafCount = computed(
  () =>
    selectableNodes.value.filter(
      (node) => node.menuType !== 'M' && selectedSet.value.has(node.menuId),
    ).length,
);

const allSelected = computed(
  () =>
    selectableNodes.value.length > 0 &&
    selectableNodes.value.every((node) => selectedSet.value.has(node.menuId)),
);

function nodeState(node: MenuTreeNode): 'checked' | 'indeterminate' | 'unchecked' {
  const ids = collectMenuIds(node);
  if (node.children.length === 0) {
    return selectedSet.value.has(node.menuId) ? 'checked' : 'unchecked';
  }
  const selectedCount = ids.filter((id) => selectedSet.value.has(id)).length;
  if (selectedCount === 0) {
    return 'unchecked';
  }
  if (selectedCount === ids.length) {
    return 'checked';
  }
  return 'indeterminate';
}

function addAncestors(menuId: number, target: Set<number>): void {
  let parentId = parentMap.value.get(menuId) ?? 0;
  const visited = new Set<number>();
  while (parentId > 0 && !visited.has(parentId)) {
    visited.add(parentId);
    target.add(parentId);
    parentId = parentMap.value.get(parentId) ?? 0;
  }
}

function pruneEmptyAncestors(menuId: number, target: Set<number>): void {
  let parentId = parentMap.value.get(menuId) ?? 0;
  const visited = new Set<number>();
  while (parentId > 0 && !visited.has(parentId)) {
    visited.add(parentId);
    const node = allNodeMap.value.get(parentId);
    if (!node) {
      break;
    }
    const stillHasSelection = collectMenuIds(node).some((id) => id !== parentId && target.has(id));
    if (stillHasSelection) {
      break;
    }
    target.delete(parentId);
    parentId = parentMap.value.get(parentId) ?? 0;
  }
}

function toggleNode(node: MenuTreeNode): void {
  if (props.readonly || props.locked) {
    return;
  }
  const next = new Set(selected.value);
  const ids = collectMenuIds(node);
  const fullySelected = ids.every((id) => next.has(id));
  if (fullySelected) {
    for (const id of ids) {
      next.delete(id);
    }
    pruneEmptyAncestors(node.menuId, next);
  } else {
    for (const id of ids) {
      next.add(id);
    }
    addAncestors(node.menuId, next);
  }
  selected.value = [...next];
}

function toggleCollapsed(menuId: number): void {
  const next = new Set(collapsed.value);
  if (next.has(menuId)) {
    next.delete(menuId);
  } else {
    next.add(menuId);
  }
  collapsed.value = next;
}

function expandAll(): void {
  collapsed.value = new Set();
}

function collapseAll(): void {
  collapsed.value = new Set(
    [...allNodeMap.value.values()]
      .filter((node) => node.children.length > 0)
      .map((node) => node.menuId),
  );
}

function selectAll(): void {
  if (props.readonly || props.locked) {
    return;
  }
  selected.value = selectableNodes.value.map((node) => node.menuId);
}

function clearAll(): void {
  if (props.readonly || props.locked) {
    return;
  }
  selected.value = [];
}

function rowIcon(node: MenuTreeNode) {
  if (node.menuType === 'M') {
    return resolveMenuIcon(node.icon) ?? Folder;
  }
  if (node.menuType === 'F') {
    return CircleDot;
  }
  return resolveMenuIcon(node.icon) ?? Folder;
}
</script>

<template>
  <div class="flex min-h-0 flex-col rounded-xl border bg-card shadow-sm">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
      <div class="relative min-w-44 flex-1">
        <Search class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="keyword"
          aria-label="搜索菜单名称或权限标识"
          placeholder="搜索菜单名称或权限标识"
          class="h-9 w-full rounded-md border border-input bg-background pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input v-model="onlySelected" type="checkbox" class="size-3.5 accent-primary" />
        仅看已选
      </label>
      <div class="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" @click="expandAll">展开</Button>
        <Button variant="ghost" size="sm" @click="collapseAll">收起</Button>
      </div>
      <div v-if="!props.readonly && !props.locked" class="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" :disabled="allSelected" @click="selectAll">全选</Button>
        <Button variant="ghost" size="sm" :disabled="!selected.length" @click="clearAll">
          清空
        </Button>
      </div>
    </div>

    <div v-if="props.locked" class="flex items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
      <Lock class="mt-0.5 size-3.5 shrink-0" />
      超级管理员默认拥有全部权限，菜单授权不可修改。
    </div>

    <div class="max-h-[32rem] min-h-48 flex-1 overflow-y-auto py-1">
      <div v-if="props.loading" class="space-y-2 p-4">
        <div v-for="index in 6" :key="index" class="h-9 animate-pulse rounded-md bg-muted" />
      </div>
      <template v-else-if="visibleRows.length">
        <template v-for="row in visibleRows" :key="row.menu.menuId">
          <div
            class="group flex min-h-9 items-center gap-2 rounded-md py-1 pr-3 hover:bg-muted/50"
            :style="{ paddingLeft: `${Math.min(row.level, 2) * 18 + 10}px` }"
          >
            <button
              v-if="row.hasChildren"
              type="button"
              class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              :title="collapsed.has(row.menu.menuId) ? '展开' : '收起'"
              @click="toggleCollapsed(row.menu.menuId)"
            >
              <ChevronRight v-if="collapsed.has(row.menu.menuId)" class="size-3.5" />
              <ChevronDown v-else class="size-3.5" />
            </button>
            <span v-else class="size-5 shrink-0" />

            <Checkbox
              :model-value="
                nodeState(row.menu) === 'checked'
                  ? true
                  : nodeState(row.menu) === 'indeterminate'
                    ? 'indeterminate'
                    : false
              "
              :disabled="props.readonly || props.locked"
              :aria-label="`授权 ${row.menu.menuName}`"
              @update:model-value="toggleNode(row.menu)"
            />

            <span
              class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground"
              :class="row.menu.menuType === 'M' ? 'bg-accent/70 text-accent-foreground' : ''"
            >
              <component :is="rowIcon(row.menu)" class="size-3.5" />
            </span>

            <span
              class="min-w-0 truncate text-sm"
              :class="
                cn(
                  row.menu.menuType === 'M' && 'font-medium',
                  row.menu.status === '1' && 'text-muted-foreground line-through',
                )
              "
            >
              {{ row.menu.menuName }}
            </span>

            <Badge
              :variant="
                row.menu.menuType === 'M'
                  ? 'secondary'
                  : row.menu.menuType === 'F'
                    ? 'outline'
                    : 'muted'
              "
              class="shrink-0"
            >
              {{ MENU_TYPE_LABELS[row.menu.menuType] }}
            </Badge>
            <Badge v-if="row.menu.status === '1'" variant="warning" class="shrink-0">停用</Badge>

            <span
              v-if="row.menu.perms"
              class="ml-auto hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline"
            >
              {{ row.menu.perms }}
            </span>
            <span v-else-if="row.menu.path" class="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {{ row.menu.path }}
            </span>
          </div>
        </template>
      </template>
      <EmptyState v-else compact :text="props.emptyText" />
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground"
    >
      <span>
        已选 <b class="text-foreground">{{ selected.length }}</b> 项菜单/动作，其中叶子权限
        <b class="text-foreground">{{ selectedLeafCount }}</b> 项
      </span>
      <span>目录、菜单、动作均会随勾选级联</span>
    </div>
  </div>
</template>
