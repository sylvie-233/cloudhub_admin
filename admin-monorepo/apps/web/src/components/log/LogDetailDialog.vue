<script setup lang="ts">
import type { Logininfor } from '@cloudhub/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cloudhub/ui';

import StatusBadge from '@/components/common/StatusBadge.vue';

const props = defineProps<{
  log: Logininfor | null;
}>();

const emit = defineEmits<{
  filterUser: [userName: string];
}>();

const open = defineModel<boolean>('open', { default: false });

const fields = [
  { key: 'infoId', label: '日志编号', mono: true },
  { key: 'userName', label: '登录账号', mono: true },
  { key: 'postName', label: '登录岗位' },
  { key: 'ipaddr', label: 'IP 地址', mono: true },
  { key: 'loginLocation', label: '登录地点' },
  { key: 'browser', label: '浏览器' },
  { key: 'os', label: '操作系统' },
  { key: 'loginTime', label: '登录时间', mono: true },
] as const;

function handleFilterUser(): void {
  if (!props.log) {
    return;
  }
  emit('filterUser', props.log.userName);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>登录日志详情</DialogTitle>
        <DialogDescription>记录用户登录时的账号、岗位与终端环境。</DialogDescription>
      </DialogHeader>

      <div v-if="props.log" class="overflow-hidden rounded-lg border">
        <div
          v-for="field in fields"
          :key="field.key"
          class="grid grid-cols-[7rem_1fr] border-b last:border-b-0"
        >
          <span class="bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            {{ field.label }}
          </span>
          <span
            class="min-w-0 break-all px-3 py-2.5 text-sm"
            :class="'mono' in field && field.mono && 'font-mono text-xs'"
          >
            {{ props.log[field.key] ?? '—' }}
          </span>
        </div>
        <div class="grid grid-cols-[7rem_1fr] border-t">
          <span class="bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">结果</span>
          <span class="px-3 py-2">
            <StatusBadge
              :status="props.log.status"
              true-text="登录成功"
              false-text="登录失败"
              false-variant="destructive"
            />
          </span>
        </div>
        <div class="grid grid-cols-[7rem_1fr] border-t">
          <span class="bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">消息</span>
          <span class="break-all px-3 py-2.5 text-sm">{{ props.log.msg || '—' }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">关闭</Button>
        <Button v-if="props.log" @click="handleFilterUser">查看该账号日志</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
