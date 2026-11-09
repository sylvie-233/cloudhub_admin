<script setup lang="ts">
import type { DataScope, RoleListItem, Status } from '@cloudhub/types';
import { DATA_SCOPE_LABELS } from '@cloudhub/types';
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
  Textarea,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';

const props = withDefaults(
  defineProps<{
    role: RoleListItem | null;
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [
    payload: {
      roleId?: number;
      roleName: string;
      roleKey: string;
      roleSort: number;
      dataScope: DataScope;
      status: Status;
      remark: string | null;
    },
  ];
}>();

const form = ref({
  roleName: '',
  roleKey: '',
  roleSort: '0',
  dataScope: '5' as DataScope,
  status: '0' as Status,
  remark: '',
});
const localError = ref('');

const isEdit = computed(() => Boolean(props.role?.roleId));
const isSuperAdmin = computed(() => props.role?.roleId === 1);
const displayError = computed(() => props.error || localError.value);

const scopeOptions = (['1', '2', '3', '4', '5'] as DataScope[]).map((value) => ({
  value,
  label: DATA_SCOPE_LABELS[value],
}));

function init(): void {
  localError.value = '';
  if (props.role) {
    form.value = {
      roleName: props.role.roleName,
      roleKey: props.role.roleKey,
      roleSort: String(props.role.roleSort),
      dataScope: props.role.dataScope,
      status: props.role.status,
      remark: props.role.remark ?? '',
    };
  } else {
    form.value = {
      roleName: '',
      roleKey: '',
      roleSort: '0',
      dataScope: '5',
      status: '0',
      remark: '',
    };
  }
}

function handleSubmit(): void {
  const roleName = form.value.roleName.trim();
  const roleKey = form.value.roleKey.trim();
  const roleSort = Number(form.value.roleSort);
  if (!roleName) {
    localError.value = '请输入角色名称';
    return;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(roleKey)) {
    localError.value = '权限字符需以字母开头，只能包含字母、数字、冒号、下划线和短横线';
    return;
  }
  if (!form.value.roleSort.trim() || !Number.isInteger(roleSort) || roleSort < 0) {
    localError.value = '显示顺序必须为不小于 0 的整数';
    return;
  }
  localError.value = '';
  emit('submit', {
    roleId: props.role?.roleId,
    roleName,
    roleKey,
    roleSort,
    dataScope: form.value.dataScope,
    status: form.value.status,
    remark: form.value.remark.trim() || null,
  });
}

watch(
  [() => open.value, () => props.role],
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
    <DialogContent
      class="max-h-[92vh] max-w-xl overflow-y-auto"
      :close-disabled="props.saving"
    >
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑角色' : '新增角色' }}</DialogTitle>
        <DialogDescription>
          角色用于直接授予用户功能权限，并携带唯一的数据范围配置。
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormItem label="角色名称" for="role-name" required>
          <Input id="role-name" v-model="form.roleName" placeholder="如：组织管理员" maxlength="30" />
        </FormItem>

        <FormItem
          label="权限字符"
          for="role-key"
          required
          hint="唯一标识，如 org_admin"
        >
          <Input id="role-key" v-model="form.roleKey" placeholder="org_admin" maxlength="100" />
        </FormItem>

        <FormItem label="显示顺序" for="role-sort" hint="数字越小越靠前">
          <Input id="role-sort" v-model="form.roleSort" type="number" min="0" />
        </FormItem>

        <FormItem
          label="数据范围"
          for="role-scope"
          :hint="isSuperAdmin ? '超级管理员数据范围锁定为全部数据' : '可在权限管理页单独调整'"
        >
          <Select v-model="form.dataScope" :disabled="isSuperAdmin">
            <SelectTrigger id="role-scope" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in scopeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem
          label="状态"
          for="role-status"
          :hint="isSuperAdmin ? '内置超级管理员不可停用' : undefined"
        >
          <Select v-model="form.status" :disabled="isSuperAdmin">
            <SelectTrigger id="role-status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="备注" for="role-remark" class="sm:col-span-2" hint="最多 500 字">
          <Textarea
            id="role-remark"
            v-model="form.remark"
            class="min-h-20"
            placeholder="角色职责说明（可选）"
            maxlength="500"
          />
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
          {{ isEdit ? '保存修改' : '创建角色' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
