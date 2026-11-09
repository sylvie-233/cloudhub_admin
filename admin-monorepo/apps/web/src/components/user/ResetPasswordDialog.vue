<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@cloudhub/ui';
import { Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';

const props = withDefaults(
  defineProps<{
    userName: string;
    saving?: boolean;
    error?: string;
  }>(),
  { saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [password: string];
}>();

const password = ref('');
const confirmPassword = ref('');
const localError = ref('');
const displayError = computed(() => props.error || localError.value);

function handleSubmit(): void {
  if (props.saving) {
    return;
  }
  if (password.value.length < 6 || password.value.length > 32) {
    localError.value = '密码长度需为 6-32 位';
    return;
  }
  if (password.value !== confirmPassword.value) {
    localError.value = '两次输入的密码不一致';
    return;
  }
  localError.value = '';
  emit('submit', password.value);
}

watch(
  () => open.value,
  (opened) => {
    if (opened) {
      password.value = '';
      confirmPassword.value = '';
      localError.value = '';
    }
  },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>重置密码</DialogTitle>
        <DialogDescription>
          用户 <b class="text-foreground">{{ props.userName }}</b> 的登录密码将被更新。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <FormItem label="新密码" for="reset-password" required hint="6-32 位">
          <Input
            id="reset-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            placeholder="请输入新密码"
            :disabled="props.saving"
          />
        </FormItem>
        <FormItem label="确认新密码" for="reset-password-confirm" required>
          <Input
            id="reset-password-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            :disabled="props.saving"
            @keyup.enter="handleSubmit"
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
          确认重置
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
