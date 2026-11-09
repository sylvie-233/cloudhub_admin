<script setup lang="ts">
import { PERMS } from '@cloudhub/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@cloudhub/ui';
import {
  Bell,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  perm?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navGroups: NavGroup[] = [
  {
    label: '概览',
    items: [{ label: '工作台', to: 'dashboard', icon: LayoutDashboard }],
  },
  {
    label: '系统权限',
    items: [
      { label: '组织管理', to: 'orgs', icon: Building2, perm: PERMS.ORG_LIST },
      { label: '用户管理', to: 'users', icon: Users, perm: PERMS.USER_LIST },
      { label: '角色管理', to: 'roles', icon: ShieldCheck, perm: PERMS.ROLE_LIST },
      { label: '菜单管理', to: 'menus', icon: Menu, perm: PERMS.MENU_LIST },
      { label: '权限管理', to: 'permissions', icon: KeyRound, perm: PERMS.PERM_LIST },
      { label: '系统日志', to: 'logs', icon: ScrollText, perm: PERMS.LOGININFOR_LIST },
    ],
  },
];

const visibleGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => auth.hasPerm(item.perm)),
    }))
    .filter((group) => group.items.length > 0),
);

const pageTitle = computed(() => route.meta.title ?? '');
const currentPost = computed(() => auth.currentPost);
const otherPosts = computed(() =>
  (auth.profile?.posts ?? []).filter((post) => post.postId !== currentPost.value?.postId),
);
const roleNames = computed(() => (auth.profile?.roles ?? []).map((role) => role.roleName));
const avatarText = computed(() => auth.displayName.slice(0, 1).toUpperCase());

function isActive(name: string): boolean {
  return route.name === name;
}

async function handleLogout(): Promise<void> {
  await auth.logout();
  toast.success('已退出登录');
  await router.replace({ name: 'login' });
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

      <nav class="flex-1 overflow-y-auto px-2 py-3 lg:px-3">
        <div v-for="group in visibleGroups" :key="group.label" class="mb-4">
          <p
            class="mb-1.5 hidden px-2 text-[11px] font-medium tracking-wide text-muted-foreground lg:block"
          >
            {{ group.label }}
          </p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              :to="{ name: item.to }"
              :title="item.label"
              class="flex h-10 items-center justify-center gap-2.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start lg:px-3"
              :class="
                isActive(item.to)
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
        <div class="flex min-w-0 items-center gap-1.5 text-sm">
          <span class="text-muted-foreground">首页</span>
          <span class="text-muted-foreground">/</span>
          <span class="truncate font-medium">{{ pageTitle }}</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="消息"
          >
            <Bell class="size-[18px]" />
            <span class="absolute top-2 right-2 size-1.5 rounded-full bg-destructive" />
          </button>

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
