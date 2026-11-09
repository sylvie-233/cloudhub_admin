<script setup lang="ts">
import { Button, Input, Label, toast } from '@cloudhub/ui';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Network,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const REMEMBER_KEY = 'cloudhub_login_account';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const rememberedAccount = localStorage.getItem(REMEMBER_KEY) ?? '';
const userName = ref(rememberedAccount);
const password = ref('');
const remember = ref(Boolean(rememberedAccount));
const showPassword = ref(false);
const submitting = ref(false);
const formError = ref('');

const features = [
  { icon: Building2, title: '组织树与岗位汇报线', text: '最多九级组织，权限沿 ancestor 路径向下继承' },
  { icon: ShieldCheck, title: '角色 / 岗位 / 组织三源授权', text: '功能权限取并集，数据范围只来自角色' },
  { icon: Users, title: '责任岗位自动识别', text: '组织的在岗责任人由 leader_post_id 唯一确定' },
];

function safeRedirect(): string {
  const raw = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  const path = raw.split(/[?#]/, 1)[0] ?? '';
  if (
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    path !== '/login' &&
    !path.startsWith('/login/')
  ) {
    return raw;
  }
  return '/dashboard';
}

function fillDemo(): void {
  userName.value = 'admin';
  password.value = 'admin123';
  formError.value = '';
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  const account = userName.value.trim();
  if (!account) {
    formError.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    formError.value = '请输入密码';
    return;
  }

  formError.value = '';
  submitting.value = true;
  try {
    const profile = await auth.login({ userName: account, password: password.value });
    // 仅在登录成功后记住账号，避免把无效账号写入本地存储
    if (remember.value) {
      localStorage.setItem(REMEMBER_KEY, account);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    toast.success(`欢迎回来，${profile.nickName || profile.userName}`);
    await router.replace(safeRedirect());
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '登录失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0,transparent_35%),radial-gradient(circle_at_90%_90%,#e0e7ff_0,transparent_40%)] px-4 py-8"
  >
    <div
      class="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgba(37,99,235,0.25)] lg:grid-cols-[1.05fr_1fr]"
    >
      <section
        class="relative hidden flex-col justify-between overflow-hidden bg-[#1e40af] p-10 text-white lg:flex"
      >
        <div class="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/10" />
        <div class="pointer-events-none absolute -bottom-28 -left-16 size-80 rounded-full bg-white/5" />

        <div class="relative">
          <div class="flex items-center gap-3">
            <span class="flex size-10 items-center justify-center rounded-xl bg-white/15">
              <Network class="size-5" />
            </span>
            <div>
              <b class="block text-sm font-semibold">云枢 Admin</b>
              <span class="text-xs text-blue-100">CloudHub 组织权限中心</span>
            </div>
          </div>

          <h1 class="mt-12 text-3xl leading-snug font-semibold tracking-tight">
            让组织、岗位与权限<br />
            保持清晰一致
          </h1>
          <p class="mt-3 max-w-sm text-sm leading-relaxed text-blue-100">
            以组织树为骨架、责任岗位为落点，统一管理用户授权与数据范围。
          </p>

          <div class="mt-10 space-y-5">
            <div v-for="item in features" :key="item.title" class="flex items-start gap-3">
              <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <component :is="item.icon" class="size-4" />
              </span>
              <div>
                <p class="text-sm font-medium">{{ item.title }}</p>
                <p class="mt-0.5 text-xs leading-relaxed text-blue-100">{{ item.text }}</p>
              </div>
            </div>
          </div>
        </div>

        <p class="relative mt-10 text-[11px] text-blue-200">
          CloudHub Admin · Vue 3 + Hono · 组织权限演示
        </p>
      </section>

      <section class="p-6 sm:p-10">
        <div class="mb-8 flex items-center gap-2.5 lg:hidden">
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Network class="size-4" />
          </span>
          <b class="text-sm font-semibold">云枢 Admin</b>
        </div>

        <div class="mb-7">
          <h2 class="text-2xl font-semibold tracking-tight">账号登录</h2>
          <p class="mt-1.5 text-sm text-muted-foreground">登录后使用组织权限管理控制台</p>
        </div>

        <form class="space-y-5" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="login-user">用户名</Label>
            <div class="relative">
              <Users class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-user"
                v-model="userName"
                class="pl-9"
                placeholder="请输入用户名"
                autocomplete="username"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="login-password">密码</Label>
            <div class="relative">
              <KeyRound class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                v-model="password"
                class="pr-10 pl-9"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                :title="showPassword ? '隐藏密码' : '显示密码'"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="size-4" />
                <Eye v-else class="size-4" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                v-model="remember"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              />
              记住账号
            </label>
            <span class="text-xs text-muted-foreground">忘记密码请联系管理员</span>
          </div>

          <p
            v-if="formError"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            {{ formError }}
          </p>

          <Button type="submit" size="lg" class="w-full" :disabled="submitting">
            <Loader2 v-if="submitting" class="size-4 animate-spin" />
            <template v-else>
              登录系统
              <ArrowRight class="size-4" />
            </template>
          </Button>
        </form>

        <div class="mt-7 rounded-xl border border-dashed border-border bg-muted/40 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium">演示账号</p>
              <p class="mt-1 font-mono text-xs text-muted-foreground">admin / admin123</p>
            </div>
            <Button variant="outline" size="sm" type="button" @click="fillDemo">一键填入</Button>
          </div>
          <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            种子数据中的用户密码均为 admin123 的 BCrypt 值；登录后可在权限管理中查看三源授权结果。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
