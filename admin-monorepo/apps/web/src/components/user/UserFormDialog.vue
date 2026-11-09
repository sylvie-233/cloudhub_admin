<script setup lang="ts">
import type { Sex, Status, UserListItem } from '@cloudhub/types';
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
import MultiSelect from '@/components/common/MultiSelect.vue';
import type { MultiSelectOption } from '@/components/common/types';

const props = withDefaults(
  defineProps<{
    user: UserListItem | null;
    postOptions: MultiSelectOption[];
    postOptionsLoading?: boolean;
    postOptionsError?: string;
    roleOptions: MultiSelectOption[];
    canAssignRoles?: boolean;
    saving?: boolean;
    error?: string;
  }>(),
  {
    postOptionsLoading: false,
    postOptionsError: '',
    canAssignRoles: false,
    saving: false,
    error: '',
  },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [
    payload: {
      userId?: number;
      userName: string;
      nickName: string;
      password?: string;
      email: string;
      phonenumber: string;
      sex: Sex;
      status: Status;
      postIds: number[];
      roleIds?: number[];
    },
  ];
}>();

const form = ref({
  userName: '',
  nickName: '',
  password: '',
  email: '',
  phonenumber: '',
  sex: '2' as Sex,
  status: '0' as Status,
  postIds: [] as number[],
  roleIds: [] as number[],
});
const localError = ref('');

const isEdit = computed(() => Boolean(props.user?.userId));
const displayError = computed(() => props.error || localError.value);

function init(): void {
  localError.value = '';
  if (props.user) {
    form.value = {
      userName: props.user.userName,
      nickName: props.user.nickName,
      password: '',
      email: props.user.email,
      phonenumber: props.user.phonenumber,
      sex: props.user.sex,
      status: props.user.status,
      postIds: props.user.posts.map((post) => post.postId),
      // 超级管理员角色仅内置 admin 可持有；历史上误授的 roleId=1 在下次保存时清理
      roleIds: props.user.roles
        .map((role) => role.roleId)
        .filter((roleId) => props.user?.userId === 1 || roleId !== 1),
    };
  } else {
    form.value = {
      userName: '',
      nickName: '',
      password: '',
      email: '',
      phonenumber: '',
      sex: '2',
      status: '0',
      postIds: [],
      roleIds: [],
    };
  }
}

function handleSubmit(): void {
  const userName = form.value.userName.trim();
  const nickName = form.value.nickName.trim();
  if (!isEdit.value && !/^[a-zA-Z][a-zA-Z0-9_]{1,29}$/.test(userName)) {
    localError.value = '账号需以字母开头，2-30 位，只能包含字母、数字和下划线';
    return;
  }
  if (!nickName) {
    localError.value = '请输入用户昵称';
    return;
  }
  if (form.value.password && (form.value.password.length < 6 || form.value.password.length > 32)) {
    localError.value = '密码长度需为 6-32 位';
    return;
  }
  const email = form.value.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    localError.value = '邮箱格式不正确';
    return;
  }
  const phonenumber = form.value.phonenumber.trim();
  if (phonenumber && !/^1\d{10}$/.test(phonenumber)) {
    localError.value = '手机号格式不正确';
    return;
  }
  if (form.value.postIds.length === 0) {
    localError.value = '请至少选择一个任职岗位';
    return;
  }

  localError.value = '';
  emit('submit', {
    userId: props.user?.userId,
    userName,
    nickName,
    password: form.value.password || undefined,
    // 传空字符串而非 undefined，编辑时才能清空已保存的邮箱 / 手机号
    email,
    phonenumber,
    sex: form.value.sex,
    status: form.value.status,
    postIds: form.value.postIds,
    // 无分配角色权限时完全省略，避免把现有角色清空
    ...(props.canAssignRoles ? { roleIds: form.value.roleIds } : {}),
  });
}

watch(
  [() => open.value, () => props.user],
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
      class="max-h-[92vh] max-w-2xl overflow-y-auto"
      :close-disabled="props.saving"
    >
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑用户' : '新增用户' }}</DialogTitle>
        <DialogDescription>
          {{
            isEdit
              ? '用户不直接绑定组织，组织归属由所选岗位推导。'
              : '至少选择一个岗位；密码留空时默认使用 admin123。'
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormItem
          label="登录账号"
          for="user-name"
          required
          :hint="isEdit ? '登录账号创建后不可修改' : '以字母开头，2-30 位'"
        >
          <Input
            id="user-name"
            v-model="form.userName"
            placeholder="如：zhangsan"
            :disabled="isEdit"
            maxlength="30"
          />
        </FormItem>

        <FormItem label="用户昵称" for="user-nickname" required>
          <Input id="user-nickname" v-model="form.nickName" placeholder="如：张三" maxlength="30" />
        </FormItem>

        <FormItem
          v-if="!isEdit"
          label="初始密码"
          for="user-password"
          hint="留空则使用默认密码 admin123"
        >
          <Input
            id="user-password"
            v-model="form.password"
            type="password"
            placeholder="至少 6 位"
            autocomplete="new-password"
          />
        </FormItem>

        <FormItem label="性别" for="user-sex">
          <Select v-model="form.sex">
            <SelectTrigger id="user-sex" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">男</SelectItem>
              <SelectItem value="1">女</SelectItem>
              <SelectItem value="2">未知</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="邮箱" for="user-email">
          <Input id="user-email" v-model="form.email" placeholder="可选" maxlength="50" />
        </FormItem>

        <FormItem label="手机号" for="user-phone" hint="11 位手机号">
          <Input id="user-phone" v-model="form.phonenumber" placeholder="可选" maxlength="11" />
        </FormItem>

        <FormItem label="状态" for="user-status">
          <Select v-model="form.status">
            <SelectTrigger id="user-status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem
          label="任职岗位"
          required
          hint="一个用户可持有跨组织的多个岗位，无主次之分"
          class="sm:col-span-2"
        >
          <MultiSelect
            id="user-posts"
            v-model="form.postIds"
            aria-label="任职岗位"
            :options="props.postOptions"
            :loading="props.postOptionsLoading"
            placeholder="选择岗位（可多选，支持跨组织）"
            search-placeholder="搜索岗位或组织"
            :max-chips="5"
          />
          <p
            v-if="props.postOptionsError"
            class="mt-1.5 text-xs text-destructive"
          >
            {{ props.postOptionsError }}
          </p>
        </FormItem>

        <FormItem
          v-if="props.canAssignRoles"
          label="直接授予角色"
          :hint="
            props.user?.userId === 1
              ? '内置 admin 的超级管理员角色已锁定，不可移除'
              : '角色只决定功能权限与数据范围，不改变组织归属'
          "
          class="sm:col-span-2"
        >
          <MultiSelect
            id="user-roles"
            v-model="form.roleIds"
            aria-label="直接授予角色"
            :options="props.roleOptions"
            placeholder="选择角色（可多选）"
            search-placeholder="搜索角色"
            :max-chips="5"
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
          {{ isEdit ? '保存修改' : '创建用户' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
