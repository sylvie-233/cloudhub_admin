<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-xl font-semibold tracking-tight">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
