<script setup lang="ts">
import type { DashboardStats, Logininfor } from '@cloudhub/types';
import { PERMS } from '@cloudhub/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  BriefcaseBusiness,
  Building2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
  UserSquare2,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { dashboardApi } from '@/api';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const stats = ref<DashboardStats | null>(null);
const loading = ref(false);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return '上午好';
  }
  if (hour < 18) {
    return '下午好';
  }
  return '晚上好';
});

const todayText = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());

const headcounts = computed(() =>
  [...(stats.value?.orgHeadcounts ?? [])].sort((a, b) => b.headcount - a.headcount).slice(0, 7),
);

const maxHeadcount = computed(() =>
  Math.max(1, ...headcounts.value.map((item) => item.headcount)),
);

const recentLogins = computed<Logininfor[]>(() => (stats.value?.recentLogins ?? []).slice(0, 6));

const quickActions = computed(() =>
  [
    { label: '新增组织', description: '维护组织树与责任岗位', to: { name: 'orgs' }, icon: Building2, perm: PERMS.ORG_LIST },
    { label: '新增用户', description: '分配岗位与角色', to: { name: 'users' }, icon: UserSquare2, perm: PERMS.USER_LIST },
    { label: '配置权限', description: '三源授权与数据范围', to: { name: 'permissions' }, icon: KeyRound, perm: PERMS.PERM_LIST },
    { label: '查看日志', description: '登录记录与安全审计', to: { name: 'logs' }, icon: ShieldCheck, perm: PERMS.LOGININFOR_LIST },
  ].filter((item) => auth.hasPerm(item.perm)),
);

function barWidth(count: number): string {
  return `${Math.max(3, Math.round((count / maxHeadcount.value) * 100))}%`;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    stats.value = await dashboardApi.stats();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '工作台数据加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-[1440px]">
    <PageHeader
      :title="`${greeting}，${auth.displayName}`"
      :description="`${todayText} · 这里是组织权限与用户运行概览`"
    >
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" @click="load">
          <RefreshCw class="size-4" :class="loading && 'animate-spin'" />
          刷新数据
        </Button>
      </template>
    </PageHeader>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="组织总数"
        :value="loading ? '—' : (stats?.orgCount ?? 0)"
        :hint="stats ? `组织树最大层级 ${stats.orgMaxLevel} 级` : '加载中…'"
        :icon="Building2"
        tone="blue"
      />
      <StatCard
        label="岗位总数"
        :value="loading ? '—' : (stats?.postCount ?? 0)"
        :hint="stats ? `已设置责任岗位的组织 ${stats.leaderPostCount} 个` : '加载中…'"
        :icon="BriefcaseBusiness"
        tone="violet"
      />
      <StatCard
        label="用户总数"
        :value="loading ? '—' : (stats?.userCount ?? 0)"
        :hint="
          stats ? `正常 ${stats.activeUserCount} · 停用 ${stats.disabledUserCount}` : '加载中…'
        "
        :icon="Users"
        tone="green"
      />
      <StatCard
        label="角色数量"
        :value="loading ? '—' : (stats?.roleCount ?? 0)"
        hint="数据范围仅由角色携带"
        :icon="ShieldCheck"
        tone="amber"
      />
    </div>

    <div v-if="quickActions.length" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="action in quickActions"
        :key="action.label"
        type="button"
        class="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        @click="router.push(action.to)"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
        >
          <component :is="action.icon" class="size-[18px]" />
        </span>
        <span class="min-w-0 flex-1">
          <b class="block truncate text-sm font-medium">{{ action.label }}</b>
          <span class="block truncate text-xs text-muted-foreground">{{ action.description }}</span>
        </span>
        <ArrowRight
          class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </button>
    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card class="min-w-0">
        <CardHeader class="p-5 pb-3">
          <CardTitle>组织在岗分布</CardTitle>
          <CardDescription>按当前正常状态在岗人数统计</CardDescription>
        </CardHeader>
        <CardContent class="p-5 pt-1">
          <div v-if="headcounts.length" class="space-y-4">
            <div v-for="item in headcounts" :key="item.orgId">
              <div class="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span class="truncate">{{ item.orgName }}</span>
                <span class="shrink-0 text-xs text-muted-foreground">{{ item.headcount }} 人</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  :style="{ width: barWidth(item.headcount) }"
                />
              </div>
            </div>
          </div>
          <EmptyState v-else compact text="暂无组织在岗数据" />
        </CardContent>
      </Card>

      <Card class="min-w-0">
        <CardHeader class="flex-row items-center justify-between p-5 pb-3">
          <div class="space-y-1.5">
            <CardTitle>最近登录</CardTitle>
            <CardDescription>最新登录记录与结果</CardDescription>
          </div>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: 'logs' }">
              查看全部
              <ArrowRight class="size-3.5" />
            </RouterLink>
          </Button>
        </CardHeader>
        <CardContent class="p-0">
          <div v-if="recentLogins.length" class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="pl-5">用户</TableHead>
                  <TableHead>岗位</TableHead>
                  <TableHead>登录时间</TableHead>
                  <TableHead class="pr-5 text-right">结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="log in recentLogins" :key="log.infoId">
                  <TableCell class="pl-5">
                    <span class="font-medium">{{ log.userName }}</span>
                  </TableCell>
                  <TableCell class="max-w-40 truncate text-muted-foreground">
                    {{ log.postName || '—' }}
                  </TableCell>
                  <TableCell class="whitespace-nowrap text-muted-foreground">
                    {{ log.loginTime }}
                  </TableCell>
                  <TableCell class="pr-5 text-right">
                    <StatusBadge
                      :status="log.status"
                      true-text="成功"
                      false-text="失败"
                      false-variant="destructive"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <EmptyState v-else compact text="暂无登录记录" />
        </CardContent>
      </Card>
    </div>

    <p class="mt-4 text-[11px] text-muted-foreground">
      当前展示 {{ headcounts.length }} 个组织在岗分布 ·
      权限规则：功能权限取角色、岗位、组织三源并集；数据范围仅来自角色。
    </p>
  </div>
</template>
