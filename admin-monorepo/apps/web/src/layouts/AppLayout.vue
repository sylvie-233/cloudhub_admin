<script setup lang="ts">
import type { NavGroup } from '@/router/menu-routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@cloudhub/ui';
import { ChevronDown, LayoutDashboard, LogOut, Network } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import appRouter, { resetMenuRoutes, syncMenuRoutes } from '@/router';
import { buildNavGroups } from '@/router/menu-routes';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

const navGroups = computed<NavGroup[]>(() => [
  {
    key: 'overview',
    label: '概览',
    icon: LayoutDashboard,
    items: [{ menuId: 0, label: '工作台', path: '/dashboard', icon: LayoutDashboard }],
    collapsible: false,
  },
  ...buildNavGroups(auth.profile?.menus ?? []),
]);

/** 仅记录被手动折叠的菜单目录，默认全部展开。 */
const collapsedGroupKeys = ref<Set<string>>(new Set());

function isGroupCollapsed(key: string): boolean {
  return collapsedGroupKeys.value.has(key);
}

function toggleGroup(key: string): void {
  const next = new Set(collapsedGroupKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  collapsedGroupKeys.value = next;
}

/** 进入某个目录下的页面时自动展开，避免当前页面在侧边栏中不可见。 */
function expandActiveGroup(): void {
  const activeGroup = navGroups.value.find((group) =>
    group.items.some((item) => item.path === route.path),
  );
  if (!activeGroup || !isGroupCollapsed(activeGroup.key)) {
    return;
  }
  const next = new Set(collapsedGroupKeys.value);
  next.delete(activeGroup.key);
  collapsedGroupKeys.value = next;
}

watch(() => route.path, expandActiveGroup, { immediate: true });

const pageTitle = computed(() => route.meta.title ?? '');

/** 当前页面所属的菜单目录，用于补全面包屑层级；概览/功能等合成分组不展示。 */
const menuGroupLabel = computed(() => {
  const group = navGroups.value.find(
    (item) => item.collapsible && item.items.some((navItem) => navItem.path === route.path),
  );
  return group?.label ?? null;
});
const currentPost = computed(() => auth.currentPost);
const otherPosts = computed(() =>
  (auth.profile?.posts ?? []).filter((post) => post.postId !== currentPost.value?.postId),
);
const roleNames = computed(() => (auth.profile?.roles ?? []).map((role) => role.roleName));
const avatarText = computed(() => auth.displayName.slice(0, 1).toUpperCase());

function isActive(path: string): boolean {
  return route.path === path;
}

// 权限刷新后同步路由；当前页面被移除时回到工作台，避免停留在失效页面
watch(
  () => auth.profile?.menus,
  (menus) => {
    if (!menus) {
      return;
    }
    const changed = syncMenuRoutes(menus);
    if (
      changed &&
      typeof route.name === 'string' &&
      route.name.startsWith('menu-') &&
      !appRouter.hasRoute(route.name)
    ) {
      toast.error('页面权限已变更，请重新选择页面');
      void appRouter.replace({ name: 'dashboard' });
    }
  },
);

async function handleLogout(): Promise<void> {
  try {
    await auth.logout();
  } catch {
    // 退出接口失败时本地会话已在 store 中清理，继续跳转登录页
  } finally {
    resetMenuRoutes();
  }
  toast.success('已退出登录');
  await appRouter.replace({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <aside
      class="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-border bg-card lg:w-56"
    >
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="flex h-14 items-center justify-center gap-2.5 border-b border-border px-3 lg:justify-start lg:px-5"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Network class="size-4" />
        </span>
        <span class="hidden min-w-0 lg:block">
          <b class="block truncate text-sm font-semibold">云枢 Admin</b>
          <span class="block truncate text-[11px] text-muted-foreground">组织权限管理</span>
        </span>
      </RouterLink>

      <nav class="flex-1 overflow-y-auto px-2 py-3 lg:px-3" aria-label="主导航">
        <div v-for="group in navGroups" :key="group.key" class="mb-4">
          <button
            v-if="group.collapsible"
            type="button"
            class="mb-1.5 hidden w-full items-center gap-2.5 rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:flex"
            :aria-expanded="!isGroupCollapsed(group.key)"
            :aria-controls="`nav-group-${group.key}`"
            @click="toggleGroup(group.key)"
          >
            <component :is="group.icon" v-if="group.icon" class="size-[18px] shrink-0" />
            <span class="min-w-0 flex-1 truncate text-left">{{ group.label }}</span>
            <ChevronDown
              class="size-4 shrink-0 transition-transform"
              :class="isGroupCollapsed(group.key) ? '-rotate-90' : ''"
            />
          </button>
          <p
            v-else
            class="mb-1.5 hidden items-center gap-2.5 px-3 py-1 text-sm font-medium text-muted-foreground lg:flex"
          >
            <component :is="group.icon" v-if="group.icon" class="size-[18px] shrink-0" />
            <span class="truncate">{{ group.label }}</span>
          </p>
          <div
            :id="`nav-group-${group.key}`"
            class="space-y-1"
            :class="group.collapsible && isGroupCollapsed(group.key) ? 'lg:hidden' : ''"
          >
            <RouterLink
              v-for="item in group.items"
              :key="item.menuId"
              :to="item.path"
              :title="item.label"
              :aria-current="isActive(item.path) ? 'page' : undefined"
              class="flex h-10 items-center justify-center gap-2.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start lg:pl-8 lg:pr-3"
              :class="
                isActive(item.path)
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground'
              "
            >
              <component :is="item.icon" class="size-[18px] shrink-0" />
              <span class="hidden truncate lg:inline">{{ item.label }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <div class="hidden border-t border-border p-3 lg:block">
        <div class="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
          <span class="size-1.5 rounded-full bg-emerald-500" />
          <div class="min-w-0">
            <p class="text-xs font-medium">服务运行中</p>
            <p class="truncate text-[11px] text-muted-foreground">云枢权限中心</p>
          </div>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:px-5"
      >
        <nav class="flex min-w-0 items-center gap-1.5 text-sm" aria-label="面包屑导航">
          <RouterLink
            :to="{ name: 'dashboard' }"
            class="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            首页
          </RouterLink>
          <template v-if="menuGroupLabel">
            <span class="text-muted-foreground">/</span>
            <span class="truncate text-muted-foreground">{{ menuGroupLabel }}</span>
          </template>
          <span class="text-muted-foreground">/</span>
          <span class="truncate font-medium">{{ pageTitle }}</span>
        </nav>

        <div class="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                >
                  {{ avatarText }}
                </span>
                <span class="hidden min-w-0 sm:block">
                  <b class="block max-w-32 truncate text-sm font-medium">{{ auth.displayName }}</b>
                  <span class="block max-w-32 truncate text-[11px] text-muted-foreground">
                    {{ currentPost?.postName ?? '未绑定岗位' }}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel>当前身份</DropdownMenuLabel>
              <div class="px-2 pb-2">
                <p class="truncate text-sm font-medium">
                  {{ auth.profile?.userName }}
                  <span class="font-normal text-muted-foreground">· {{ auth.displayName }}</span>
                </p>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">
                  {{ currentPost ? `${currentPost.orgPath} / ${currentPost.postName}` : '未绑定岗位' }}
                </p>
                <p v-if="roleNames.length" class="mt-0.5 truncate text-xs text-muted-foreground">
                  角色：{{ roleNames.join('、') }}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel v-if="otherPosts.length">其他岗位</DropdownMenuLabel>
              <DropdownMenuItem
                v-for="post in otherPosts"
                :key="post.postId"
                :disabled="true"
                class="items-start"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm">{{ post.postName }}</p>
                  <p class="truncate text-xs text-muted-foreground">{{ post.orgPath }}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator v-if="otherPosts.length" />
              <DropdownMenuItem variant="destructive" @select="handleLogout">
                <LogOut class="size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main class="min-w-0 flex-1 px-4 py-4 lg:px-5 lg:py-[18px]">
        <RouterView />
      </main>
    </div>
  </div>
</template>
