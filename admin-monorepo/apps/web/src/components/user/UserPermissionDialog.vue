<script setup lang="ts">
import type { MenuTreeNode, OrgTreeNode, UserPermissionDetail } from '@cloudhub/types';
import { DATA_SCOPE_LABELS, DATA_SCOPE_NOTES, PERMS } from '@cloudhub/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cloudhub/ui';
import { Loader2, ShieldCheck } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { menuApi, userApi } from '@/api';
import PermissionTree from '@/components/permission/PermissionTree.vue';
import { useAuthStore } from '@/stores/auth';
import { flattenOrgTree } from '@/utils/format';

const auth = useAuthStore();

const props = withDefaults(
  defineProps<{
    userId: number | null;
    userName: string;
    nickName: string;
    orgs: OrgTreeNode[];
  }>(),
  {},
);

const open = defineModel<boolean>('open', { default: false });

const loading = ref(false);
const error = ref('');
const detail = ref<UserPermissionDetail | null>(null);
const menus = ref<MenuTreeNode[]>([]);
const menuUnavailable = ref(false);
const activeKey = ref('all');
let loadRequestId = 0;

/** 菜单树接口只对 MENU_LIST / PERM_QUERY 开放；无权限时降级展示权限 ID。 */
const canReadMenuTree = computed(
  () => auth.hasPerm(PERMS.MENU_LIST) || auth.hasPerm(PERMS.PERM_QUERY),
);

const activeSource = computed(
  () => detail.value?.sources.find((source) => source.key === activeKey.value) ?? null,
);

const activeMenuIds = computed(() => activeSource.value?.menuIds ?? detail.value?.menuIds ?? []);

const orgNameMap = computed(
  () => new Map(flattenOrgTree(props.orgs).map((row) => [row.org.orgId, row.path])),
);

const scopeOrgNames = computed(() =>
  (detail.value?.dataScopeOrgIds ?? []).map(
    (orgId) => orgNameMap.value.get(orgId) ?? `组织 #${orgId}`,
  ),
);

const sourceTypeLabels: Record<string, string> = {
  user: '角色',
  post: '岗位',
  org: '组织',
};

async function load(): Promise<void> {
  if (!props.userId) {
    return;
  }
  const requestId = ++loadRequestId;
  loading.value = true;
  error.value = '';
  detail.value = null;
  menus.value = [];
  menuUnavailable.value = false;
  activeKey.value = 'all';
  try {
    const menuPromise: Promise<MenuTreeNode[] | null> = canReadMenuTree.value
      ? menuApi.tree()
      : Promise.resolve(null);
    const [permissionResult, menuResult] = await Promise.allSettled([
      userApi.permissions(props.userId),
      menuPromise,
    ]);
    if (requestId !== loadRequestId) {
      return;
    }
    if (permissionResult.status === 'rejected') {
      throw permissionResult.reason;
    }
    detail.value = permissionResult.value;
    if (menuResult.status === 'fulfilled' && menuResult.value) {
      menus.value = menuResult.value;
    } else {
      menuUnavailable.value = true;
    }
  } catch (loadError) {
    if (requestId !== loadRequestId) {
      return;
    }
    error.value = loadError instanceof Error ? loadError.message : '权限详情加载失败';
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
    }
  }
}

watch(
  [() => open.value, () => props.userId],
  () => {
    if (open.value) {
      void load();
    } else {
      // 关闭后使仍在途的请求失效
      loadRequestId += 1;
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>查看用户权限</DialogTitle>
        <DialogDescription>
          {{ props.nickName }}（{{ props.userName }}）· 合并后的功能权限与来源明细
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" />
        正在加载权限明细…
      </div>

      <div v-else-if="error" class="space-y-3 py-8 text-center">
        <p class="text-sm text-destructive">{{ error }}</p>
        <Button variant="outline" size="sm" @click="load">重试</Button>
      </div>

      <template v-else-if="detail">
        <div class="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_auto]">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <ShieldCheck class="size-4 text-primary" />
              <span class="text-sm font-medium">数据范围</span>
              <Badge variant="secondary">{{ DATA_SCOPE_LABELS[detail.dataScope] }}</Badge>
              <span class="text-xs text-muted-foreground">
                共 {{ detail.menuIds.length }} 项合并权限
              </span>
            </div>
            <p class="mt-1.5 text-xs text-muted-foreground">
              {{ DATA_SCOPE_NOTES[detail.dataScope] }}
            </p>
            <p
              v-if="detail.dataScope === '2' && scopeOrgNames.length"
              class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
            >
              自定义组织：{{ scopeOrgNames.join('、') }}
            </p>
          </div>
          <div class="text-right text-xs text-muted-foreground">
            <p>岗位 / 组织直授不携带数据范围</p>
            <p class="mt-0.5">多角色取最宽的一档</p>
          </div>
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-1">
          <button
            v-for="source in detail.sources"
            :key="source.key"
            type="button"
            class="shrink-0 rounded-lg border px-3 py-2 text-left transition-colors"
            :class="
              activeKey === source.key
                ? 'border-primary bg-accent/60 text-accent-foreground'
                : 'border-border bg-background hover:border-primary/30'
            "
            @click="activeKey = source.key"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium">{{ source.name }}</span>
              <Badge variant="outline">
                {{ source.key === 'all' ? '综合' : (sourceTypeLabels[source.type] ?? source.type) }}
              </Badge>
            </div>
            <p class="mt-1 max-w-56 truncate text-[11px] text-muted-foreground">
              {{ source.sub }}
            </p>
            <p class="mt-1 text-[11px] text-muted-foreground">{{ source.menuIds.length }} 项</p>
          </button>
        </div>

        <div v-if="menuUnavailable" class="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p class="text-xs text-muted-foreground">
            当前账号无权读取菜单树，无法展示菜单名称与层级；以下为当前来源授予的菜单 / 动作 ID。
          </p>
          <div class="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            <Badge v-if="!activeMenuIds.length" variant="outline">暂无菜单权限</Badge>
            <Badge v-for="menuId in activeMenuIds" :key="menuId" variant="muted">
              #{{ menuId }}
            </Badge>
          </div>
        </div>

        <PermissionTree
          v-else
          :menus="menus"
          :model-value="activeMenuIds"
          readonly
          empty-text="该来源暂无菜单权限"
        />

        <DialogFooter>
          <Button variant="outline" @click="open = false">关闭</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
