<script setup lang="ts">
import type {
  Logininfor,
  LogininforQuery,
  LogininforStats,
  Status,
} from '@cloudhub/types';
import { PERMS } from '@cloudhub/types';
import {
  Button,
  Checkbox,
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
  CircleCheck,
  CircleX,
  Download,
  Eraser,
  Eye,
  Loader2,
  LogIn,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';

import { logApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import Pagination from '@/components/common/Pagination.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import LogDetailDialog from '@/components/log/LogDetailDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime } from '@/utils/format';

type RangeFilter = 'all' | 'today' | '7' | '30';

const auth = useAuthStore();

const canQuery = computed(() => auth.hasPerm(PERMS.LOGININFOR_QUERY));
const canExport = computed(() => auth.hasPerm(PERMS.LOGININFOR_EXPORT));
const canRemove = computed(() => auth.hasPerm(PERMS.LOGININFOR_REMOVE));
const canClean = computed(() => auth.hasPerm(PERMS.LOGININFOR_CLEAN));

/* ==================== 概览 ==================== */
const stats = ref<LogininforStats | null>(null);
const statsLoading = ref(false);
const statsError = ref('');

async function loadStats(): Promise<boolean> {
  statsLoading.value = true;
  statsError.value = '';
  try {
    stats.value = await logApi.stats();
    return true;
  } catch (error) {
    stats.value = null;
    statsError.value = error instanceof Error ? error.message : '登录日志统计加载失败';
    return false;
  } finally {
    statsLoading.value = false;
  }
}

/* ==================== 筛选与列表 ==================== */
const logs = ref<Logininfor[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const listLoading = ref(false);
const listError = ref('');

const keyword = ref('');
const filterStatus = ref<'all' | Status>('all');
const filterRange = ref<RangeFilter>('7');

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function buildQuery(includePage: boolean): LogininforQuery {
  const query: LogininforQuery = {
    keyword: keyword.value.trim() || undefined,
    status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  };

  if (filterRange.value === 'today') {
    query.startTime = todayString();
  } else if (filterRange.value !== 'all') {
    query.days = Number(filterRange.value);
  }

  if (includePage) {
    query.page = page.value;
    query.pageSize = pageSize;
  }

  return query;
}

let listRequestId = 0;

async function loadLogs(): Promise<boolean> {
  const requestId = ++listRequestId;
  listLoading.value = true;
  listError.value = '';
  try {
    const result = await logApi.list(buildQuery(true));
    if (requestId !== listRequestId) {
      return false;
    }
    const maxPage = Math.max(1, Math.ceil(result.total / pageSize));
    if (page.value > maxPage) {
      page.value = maxPage;
      return await loadLogs();
    }
    logs.value = result.list;
    total.value = result.total;
    selectedIds.value = new Set();
    return true;
  } catch (error) {
    if (requestId !== listRequestId) {
      return false;
    }
    logs.value = [];
    total.value = 0;
    selectedIds.value = new Set();
    listError.value = error instanceof Error ? error.message : '登录日志加载失败';
    return false;
  } finally {
    if (requestId === listRequestId) {
      listLoading.value = false;
    }
  }
}

/** 中文输入法确认候选词时不应触发查询。 */
function handleKeywordEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  applyFilters();
}

function applyFilters(): void {
  page.value = 1;
  void loadLogs();
}

function resetFilters(): void {
  keyword.value = '';
  filterStatus.value = 'all';
  filterRange.value = '7';
  page.value = 1;
  void loadLogs();
}

function changePage(nextPage: number): void {
  page.value = nextPage;
  void loadLogs();
}

async function refreshAll(): Promise<void> {
  const [statsOk, listOk] = await Promise.all([loadStats(), loadLogs()]);
  if (statsOk && listOk) {
    toast.success('日志数据已刷新');
  }
}

/* ==================== 选择与删除 ==================== */
const selectedIds = ref<Set<number>>(new Set());

const selectedOnPage = computed(
  () => logs.value.filter((log) => selectedIds.value.has(log.infoId)).length,
);

const pageSelectionState = computed<'none' | 'some' | 'all'>(() => {
  if (!logs.value.length || selectedOnPage.value === 0) {
    return 'none';
  }
  return selectedOnPage.value === logs.value.length ? 'all' : 'some';
});

function togglePageSelection(checked: boolean | 'indeterminate'): void {
  const shouldSelect = checked === true || checked === 'indeterminate';
  const next = new Set(selectedIds.value);
  for (const log of logs.value) {
    if (shouldSelect) {
      next.add(log.infoId);
    } else {
      next.delete(log.infoId);
    }
  }
  selectedIds.value = next;
}

function toggleRow(infoId: number): void {
  const next = new Set(selectedIds.value);
  if (next.has(infoId)) {
    next.delete(infoId);
  } else {
    next.add(infoId);
  }
  selectedIds.value = next;
}

const deleteOpen = ref(false);
const deleteIds = ref<number[]>([]);
const deleting = ref(false);

function askDeleteSelected(): void {
  if (!selectedIds.value.size) {
    return;
  }
  deleteIds.value = [...selectedIds.value];
  deleteOpen.value = true;
}

async function handleDeleteSelected(): Promise<void> {
  deleting.value = true;
  try {
    const result = await logApi.remove(deleteIds.value);
    toast.success(
      result.affected > 0 ? `已删除 ${result.affected} 条登录日志` : '没有可删除的登录日志',
    );
    deleteOpen.value = false;
    await Promise.all([loadLogs(), loadStats()]);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '删除登录日志失败');
  } finally {
    deleting.value = false;
  }
}

const cleanOpen = ref(false);
const cleaning = ref(false);

async function handleClean(): Promise<void> {
  cleaning.value = true;
  try {
    const result = await logApi.clean();
    toast.success(
      result.affected > 0 ? `已清空 ${result.affected} 条登录日志` : '当前没有登录日志',
    );
    cleanOpen.value = false;
    page.value = 1;
    await Promise.all([loadLogs(), loadStats()]);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '清空登录日志失败');
  } finally {
    cleaning.value = false;
  }
}

/* ==================== 导出 / 详情 ==================== */
const exporting = ref(false);

async function handleExport(): Promise<void> {
  exporting.value = true;
  try {
    await logApi.exportCsv(buildQuery(false));
    toast.success('已按当前筛选条件导出登录日志');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '导出登录日志失败');
  } finally {
    exporting.value = false;
  }
}

const detailOpen = ref(false);
const detailTarget = ref<Logininfor | null>(null);
const detailLoading = ref(false);
const detailError = ref('');
const detailInfoId = ref<number | null>(null);
let detailRequestId = 0;

async function fetchDetail(infoId: number): Promise<void> {
  const requestId = ++detailRequestId;
  detailLoading.value = true;
  detailError.value = '';
  detailTarget.value = null;
  try {
    const detail = await logApi.detail(infoId);
    if (requestId !== detailRequestId) {
      return;
    }
    detailTarget.value = detail;
  } catch (error) {
    if (requestId !== detailRequestId) {
      return;
    }
    detailError.value = error instanceof Error ? error.message : '日志详情加载失败';
  } finally {
    if (requestId === detailRequestId) {
      detailLoading.value = false;
    }
  }
}

function openDetail(log: Logininfor): void {
  if (!canQuery.value) {
    return;
  }
  detailInfoId.value = log.infoId;
  detailOpen.value = true;
  void fetchDetail(log.infoId);
}

function retryDetail(): void {
  if (detailInfoId.value !== null) {
    void fetchDetail(detailInfoId.value);
  }
}

watch(detailOpen, (value) => {
  if (!value) {
    // 关闭后使仍在途的详情请求失效
    detailRequestId += 1;
    detailLoading.value = false;
  }
});

function filterByUser(userName: string): void {
  keyword.value = userName;
  filterStatus.value = 'all';
  filterRange.value = 'all';
  page.value = 1;
  void loadLogs();
}

onMounted(() => {
  void Promise.all([loadStats(), loadLogs()]);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <PageHeader
      title="系统日志"
      description="登录日志记录每次登录尝试的账号、岗位、来源 IP、设备与结果，来源表 sys_logininfor。"
    >
      <template #actions>
        <Button variant="outline" size="sm" :disabled="listLoading || statsLoading" @click="refreshAll">
          <RefreshCw class="size-4" :class="(listLoading || statsLoading) && 'animate-spin'" />
          刷新
        </Button>
        <Button
          v-if="canClean"
          variant="outline"
          size="sm"
          class="text-destructive hover:text-destructive"
          @click="cleanOpen = true"
        >
          <Eraser class="size-4" />
          清空日志
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="statsError"
      class="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive"
      role="alert"
    >
      <span class="min-w-0 flex-1">登录日志统计加载失败：{{ statsError }}</span>
      <Button variant="outline" size="sm" :disabled="statsLoading" @click="loadStats">重试</Button>
    </div>

    <div class="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="今日登录"
        :value="statsLoading || !stats ? '—' : stats.todayCount"
        hint="包含成功与失败尝试"
        :icon="LogIn"
        tone="blue"
      />
      <StatCard
        label="今日成功"
        :value="statsLoading || !stats ? '—' : stats.todaySuccess"
        hint="status = '0'"
        :icon="CircleCheck"
        tone="green"
      />
      <StatCard
        label="今日失败"
        :value="statsLoading || !stats ? '—' : stats.todayFail"
        hint="status = '1'"
        :icon="CircleX"
        tone="amber"
      />
      <StatCard
        label="近 7 天账号"
        :value="statsLoading || !stats ? '—' : stats.weekUniqueUsers"
        hint="按登录账号去重"
        :icon="Users"
        tone="violet"
      />
    </div>

    <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div class="flex flex-wrap items-end gap-2 border-b p-3">
        <div class="space-y-1">
          <label for="log-filter-keyword" class="text-[11px] text-muted-foreground">关键词</label>
          <div class="relative">
            <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="log-filter-keyword"
              v-model="keyword"
              placeholder="账号 / IP / 登录地点 / 消息"
              class="h-9 w-60 rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              @keydown.enter="handleKeywordEnter"
            />
          </div>
        </div>

        <div class="w-32 space-y-1">
          <label for="log-filter-status" class="text-[11px] text-muted-foreground">结果</label>
          <Select v-model="filterStatus">
            <SelectTrigger id="log-filter-status" class="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部结果</SelectItem>
              <SelectItem value="0">登录成功</SelectItem>
              <SelectItem value="1">登录失败</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="w-32 space-y-1">
          <label for="log-filter-range" class="text-[11px] text-muted-foreground">时间范围</label>
          <Select v-model="filterRange">
            <SelectTrigger id="log-filter-range" class="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" @click="resetFilters">重置</Button>
          <Button size="sm" :disabled="listLoading" @click="applyFilters">
            <Loader2 v-if="listLoading" class="size-3.5 animate-spin" />
            <Search v-else class="size-3.5" />
            查询
          </Button>
          <Button
            v-if="canExport"
            variant="outline"
            size="sm"
            :disabled="exporting"
            @click="handleExport"
          >
            <Loader2 v-if="exporting" class="size-3.5 animate-spin" />
            <Download v-else class="size-3.5" />
            导出
          </Button>
        </div>
      </div>

      <div
        v-if="canRemove && selectedIds.size"
        class="flex flex-wrap items-center gap-2 border-b bg-accent/40 px-4 py-2"
      >
        <span class="text-xs">
          已选 <b class="font-mono">{{ selectedIds.size }}</b> 条登录日志
        </span>
        <Button variant="ghost" size="sm" @click="selectedIds = new Set()">取消选择</Button>
        <Button variant="destructive" size="sm" class="ml-auto" @click="askDeleteSelected">
          <Trash2 class="size-3.5" />
          删除所选
        </Button>
      </div>

      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead v-if="canRemove" class="w-10 pl-4">
                <Checkbox
                  :model-value="pageSelectionState === 'all'"
                  :indeterminate="pageSelectionState === 'some'"
                  aria-label="选择当前页"
                  @update:model-value="togglePageSelection"
                />
              </TableHead>
              <TableHead :class="!canRemove && 'pl-4'">账号</TableHead>
              <TableHead>登录岗位</TableHead>
              <TableHead>IP 地址</TableHead>
              <TableHead>登录地点</TableHead>
              <TableHead>浏览器 / 系统</TableHead>
              <TableHead class="min-w-36">结果</TableHead>
              <TableHead class="min-w-36">登录时间</TableHead>
              <TableHead class="pr-4 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="listLoading">
              <TableCell :colspan="canRemove ? 9 : 8">
                <div class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  正在加载登录日志…
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="listError">
              <TableCell :colspan="canRemove ? 9 : 8">
                <div class="flex flex-col items-center gap-2 py-12 text-center" role="alert">
                  <p class="text-sm text-destructive">{{ listError }}</p>
                  <Button variant="outline" size="sm" @click="loadLogs">
                    <RefreshCw class="size-3.5" />
                    重试
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            <template v-else-if="logs.length">
              <TableRow
                v-for="log in logs"
                :key="log.infoId"
                class="align-top"
              >
                <TableCell v-if="canRemove" class="pl-4">
                  <Checkbox
                    :model-value="selectedIds.has(log.infoId)"
                    :aria-label="`选择日志 ${log.infoId}`"
                    @update:model-value="toggleRow(log.infoId)"
                  />
                </TableCell>
                <TableCell :class="!canRemove && 'pl-4'">
                  <p class="text-sm font-medium">{{ log.userName }}</p>
                  <p class="font-mono text-[10px] text-muted-foreground">#{{ log.infoId }}</p>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ log.postName || '—' }}
                </TableCell>
                <TableCell class="font-mono text-xs">{{ log.ipaddr || '—' }}</TableCell>
                <TableCell class="text-xs">{{ log.loginLocation || '—' }}</TableCell>
                <TableCell>
                  <p class="text-xs">{{ log.browser || '—' }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ log.os || '—' }}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    :status="log.status"
                    true-text="登录成功"
                    false-text="登录失败"
                    false-variant="destructive"
                  />
                  <p
                    class="mt-1 max-w-48 truncate text-[11px] text-muted-foreground"
                    :title="log.msg"
                  >
                    {{ log.msg || '—' }}
                  </p>
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground">
                  {{ formatDateTime(log.loginTime) }}
                </TableCell>
                <TableCell class="pr-4 text-right">
                  <Button
                    v-if="canQuery"
                    variant="ghost"
                    size="sm"
                    @click="openDetail(log)"
                  >
                    <Eye class="size-3.5" />
                    详情
                  </Button>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell :colspan="canRemove ? 9 : 8">
                <EmptyState text="没有匹配的登录日志">
                  <Button variant="ghost" size="sm" @click="resetFilters">重置筛选</Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div v-if="!listError" class="border-t px-4 py-2">
        <Pagination
          :page="page"
          :total="total"
          :page-size="pageSize"
          :disabled="listLoading"
          @change="changePage"
        />
      </div>
    </div>

    <LogDetailDialog
      v-model:open="detailOpen"
      :log="detailTarget"
      :loading="detailLoading"
      :error="detailError"
      @filter-user="filterByUser"
      @retry="retryDetail"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="删除登录日志"
      :description="`确认删除选中的 ${deleteIds.length} 条登录日志？删除后不可恢复。`"
      confirm-text="删除"
      destructive
      :loading="deleting"
      :close-disabled="deleting"
      @confirm="handleDeleteSelected"
    />

    <ConfirmDialog
      v-model:open="cleanOpen"
      title="清空登录日志"
      description="将清空 sys_logininfor 中的全部登录日志，操作不可恢复。生产环境一般保留审计日志并配置归档策略。"
      confirm-text="确认清空"
      destructive
      :loading="cleaning"
      :close-disabled="cleaning"
      @confirm="handleClean"
    />
  </div>
</template>
