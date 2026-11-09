<script setup lang="ts">
import type { Org, OrgTreeNode, Status } from '@cloudhub/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';
import { flattenOrgTree } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    org: Org | null;
    orgs: OrgTreeNode[];
    defaultParentId?: number | null;
    saving?: boolean;
    error?: string;
  }>(),
  {
    defaultParentId: null,
    saving: false,
    error: '',
  },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [
    payload: {
      orgId?: number;
      parentId: number;
      orgName: string;
      orgCode?: string;
      orderNum?: number;
      status: Status;
    },
  ];
}>();

const form = ref({
  parentId: '0',
  orgName: '',
  orgCode: '',
  orderNum: '0',
  status: '0' as Status,
});
const localError = ref('');

const isEdit = computed(() => Boolean(props.org?.orgId));

const parentOptions = computed(() => {
  const editingId = props.org?.orgId;
  return flattenOrgTree(props.orgs).filter((row) => {
    if (row.org.orgId === editingId) {
      return false;
    }
    if (editingId && row.org.ancestors.split(',').includes(String(editingId))) {
      return false;
    }
    return true;
  });
});

const displayError = computed(() => props.error || localError.value);

function init(): void {
  localError.value = '';
  if (props.org) {
    form.value = {
      parentId: String(props.org.parentId),
      orgName: props.org.orgName,
      orgCode: props.org.orgCode,
      orderNum: String(props.org.orderNum),
      status: props.org.status,
    };
  } else {
    form.value = {
      parentId: String(props.defaultParentId ?? 0),
      orgName: '',
      orgCode: '',
      orderNum: '0',
      status: '0',
    };
  }
}

function handleSubmit(): void {
  const name = form.value.orgName.trim();
  if (!name) {
    localError.value = '请输入组织名称';
    return;
  }
  const parentId = Number(form.value.parentId);
  const parent = flattenOrgTree(props.orgs).find((row) => row.org.orgId === parentId);
  if (parent && parent.org.orgLevel >= 9) {
    localError.value = '组织树最多 9 级，不能在 9 级组织下继续新增下级';
    return;
  }
  localError.value = '';
  emit('submit', {
    orgId: props.org?.orgId,
    parentId,
    orgName: name,
    orgCode: form.value.orgCode.trim() || undefined,
    orderNum: Number(form.value.orderNum) || 0,
    status: form.value.status,
  });
}

watch(
  [() => open.value, () => props.org],
  () => {
    if (open.value) {
      init();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-xl" :close-disabled="props.saving">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑组织' : '新增组织' }}</DialogTitle>
        <DialogDescription>
          {{
            isEdit
              ? '调整组织归属会同步刷新下级组织的层级与祖级路径。'
              : '组织编码留空将自动生成，新组织会同时创建默认岗位。'
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormItem label="上级组织" for="org-parent" hint="最多支持 9 级组织">
          <Select v-model="form.parentId">
            <SelectTrigger id="org-parent" class="w-full">
              <SelectValue placeholder="选择上级组织" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">顶级组织</SelectItem>
              <SelectItem
                v-for="row in parentOptions"
                :key="row.org.orgId"
                :value="String(row.org.orgId)"
                :disabled="row.org.orgLevel >= 9"
              >
                {{ String.fromCharCode(0x3000).repeat(Math.max(0, row.level - 1)) }}{{ row.org.orgName }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="组织名称" for="org-name" required>
          <Input id="org-name" v-model="form.orgName" placeholder="如：研发中心" maxlength="100" />
        </FormItem>

        <FormItem
          label="组织编码"
          for="org-code"
          hint="留空自动生成；格式 ZZ + 日期 + 6 位序列"
        >
          <Input id="org-code" v-model="form.orgCode" placeholder="自动生成" maxlength="64" />
        </FormItem>

        <FormItem label="显示顺序" for="org-order" hint="数字越小越靠前">
          <Input id="org-order" v-model="form.orderNum" type="number" min="0" />
        </FormItem>

        <FormItem label="状态" for="org-status">
          <Select v-model="form.status">
            <SelectTrigger id="org-status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      </div>

      <p
        v-if="displayError"
        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ displayError }}
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="props.saving" @click="open = false">取消</Button>
        <Button :disabled="props.saving" @click="handleSubmit">
          <Loader2 v-if="props.saving" class="size-4 animate-spin" />
          {{ isEdit ? '保存修改' : '创建组织' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
