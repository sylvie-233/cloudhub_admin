<script setup lang="ts">
import type { DataScope, OrgTreeNode } from '@cloudhub/types';
import { DATA_SCOPE_LABELS, DATA_SCOPE_NOTES } from '@cloudhub/types';
import { Badge, Button, Checkbox, cn } from '@cloudhub/ui';
import {
  Building2,
  Globe2,
  ListChecks,
  Loader2,
  Lock,
  Network,
  Search,
  UserRound,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import EmptyState from '@/components/common/EmptyState.vue';
import { flattenOrgTree } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    orgs: OrgTreeNode[];
    loading?: boolean;
    /** 超级管理员等不可修改场景；展示锁定提示。 */
    locked?: boolean;
    /** 当前账号无保存数据范围权限；仅可查看。 */
    readonly?: boolean;
  }>(),
  { loading: false, locked: false, readonly: false },
);

const disabled = computed(() => props.locked || props.readonly);

const dataScope = defineModel<DataScope>('dataScope', { default: '5' });
const orgIds = defineModel<number[]>('orgIds', { default: () => [] });

const emit = defineEmits<{
  save: [];
  reset: [];
}>();

const keyword = ref('');

const scopeOptions = [
  { value: '1' as DataScope, icon: Globe2 },
  { value: '2' as DataScope, icon: ListChecks },
  { value: '3' as DataScope, icon: Building2 },
  { value: '4' as DataScope, icon: Network },
  { value: '5' as DataScope, icon: UserRound },
];

const allOrgs = computed(() => flattenOrgTree(props.orgs));
const selectedSet = computed(() => new Set(orgIds.value));

const filteredOrgs = computed(() => {
  const lowered = keyword.value.trim().toLowerCase();
  if (!lowered) {
    return allOrgs.value;
  }
  return allOrgs.value.filter((row) =>
    `${row.org.orgName} ${row.org.orgCode} ${row.path}`.toLowerCase().includes(lowered),
  );
});

const selectableOrgs = computed(() => allOrgs.value.map((row) => row.org.orgId));

const allSelected = computed(
  () =>
    selectableOrgs.value.length > 0 &&
    selectableOrgs.value.every((orgId) => selectedSet.value.has(orgId)),
);

function selectScope(scope: DataScope): void {
  if (!disabled.value) {
    dataScope.value = scope;
  }
}

function toggleOrg(orgId: number): void {
  if (disabled.value) {
    return;
  }
  const next = selectedSet.value.has(orgId)
    ? orgIds.value.filter((id) => id !== orgId)
    : [...orgIds.value, orgId];
  orgIds.value = next;
}

function selectAllOrgs(): void {
  if (!disabled.value) {
    orgIds.value = selectableOrgs.value;
  }
}

function clearOrgs(): void {
  if (!disabled.value) {
    orgIds.value = [];
  }
}
</script>

<template>
  <div class="rounded-xl border bg-card shadow-sm">
    <div class="border-b px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">角色数据范围</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            数据范围只来源于角色；多角色时取最宽的一档。
          </p>
        </div>
        <Badge v-if="props.locked" variant="warning">
          <Lock class="size-3" />
          超级管理员锁定
        </Badge>
        <Badge v-else-if="props.readonly" variant="muted">只读</Badge>
      </div>
    </div>

    <div class="p-4">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <button
          v-for="option in scopeOptions"
          :key="option.value"
          type="button"
          class="flex flex-col gap-2 rounded-lg border p-3 text-left transition-all"
          :class="
            cn(
              dataScope === option.value
                ? 'border-primary bg-accent/60 shadow-sm'
                : 'border-border bg-background hover:border-primary/30',
              disabled && 'cursor-not-allowed opacity-70',
            )
          "
          :disabled="disabled"
          @click="selectScope(option.value)"
        >
          <span class="flex items-center justify-between gap-2">
            <component
              :is="option.icon"
              class="size-4"
              :class="dataScope === option.value ? 'text-primary' : 'text-muted-foreground'"
            />
            <span
              class="size-2 rounded-full"
              :class="dataScope === option.value ? 'bg-primary' : 'bg-transparent'"
            />
          </span>
          <span class="text-xs font-medium">{{ DATA_SCOPE_LABELS[option.value] }}</span>
        </button>
      </div>

      <p class="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {{ DATA_SCOPE_NOTES[dataScope] }}
      </p>

      <div v-if="dataScope === '2'" class="mt-4 overflow-hidden rounded-lg border">
        <div class="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
          <div class="relative min-w-44 flex-1">
            <Search
              class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              v-model="keyword"
              aria-label="搜索组织"
              placeholder="搜索组织"
              class="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <span class="text-xs text-muted-foreground">已选 {{ orgIds.length }} 个组织</span>
          <Button
            variant="ghost"
            size="sm"
            :disabled="disabled || allSelected"
            @click="selectAllOrgs"
          >
            全选
          </Button>
          <Button variant="ghost" size="sm" :disabled="disabled" @click="clearOrgs">
            清空
          </Button>
        </div>
        <div class="max-h-64 overflow-y-auto p-1">
          <div
            v-for="row in filteredOrgs"
            :key="row.org.orgId"
            class="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted/60"
            :style="{ paddingLeft: `${Math.min(row.level, 8) * 16 + 8}px` }"
          >
            <Checkbox
              :model-value="selectedSet.has(row.org.orgId)"
              :disabled="disabled"
              :aria-label="`选择 ${row.org.orgName}`"
              @update:model-value="toggleOrg(row.org.orgId)"
            />
            <span class="min-w-0 truncate">{{ row.org.orgName }}</span>
            <span class="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
              {{ row.org.orgCode }}
            </span>
            <Badge v-if="row.org.status === '1'" variant="muted" class="ml-auto shrink-0">
              停用
            </Badge>
          </div>
          <EmptyState v-if="!filteredOrgs.length" compact text="没有匹配的组织" />
        </div>
        <p class="border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          自定义范围按勾选的组织精确生效，不会自动包含下级组织。
        </p>
      </div>
    </div>

    <div
      v-if="!disabled"
      class="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3"
    >
      <span class="text-xs text-muted-foreground">
        当前：{{ DATA_SCOPE_LABELS[dataScope] }}
        <template v-if="dataScope === '2'">（{{ orgIds.length }} 个组织）</template>
      </span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="props.loading" @click="emit('reset')">
          重置
        </Button>
        <Button size="sm" :disabled="props.loading" @click="emit('save')">
          <Loader2 v-if="props.loading" class="size-4 animate-spin" />
          保存数据范围
        </Button>
      </div>
    </div>
  </div>
</template>
