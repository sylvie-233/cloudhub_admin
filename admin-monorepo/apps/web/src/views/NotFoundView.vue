<script setup lang="ts">
import { Button } from '@cloudhub/ui';
import { Compass } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <span class="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      <Compass class="size-7" />
    </span>
    <h1 class="mt-5 text-2xl font-semibold tracking-tight">页面不存在</h1>
    <p class="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
      当前地址没有对应的菜单或页面，可能已被移除，或您没有访问权限。
    </p>
    <Button class="mt-6" @click="router.replace('/dashboard')">返回工作台</Button>
  </div>
</template>
