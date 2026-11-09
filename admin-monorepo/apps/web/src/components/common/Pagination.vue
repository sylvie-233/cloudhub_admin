<script setup lang="ts">
import { Button } from '@cloudhub/ui';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    page: number;
    total: number;
    pageSize?: number;
    disabled?: boolean;
  }>(),
  { pageSize: 10, disabled: false },
);

const emit = defineEmits<{
  change: [page: number];
}>();

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))));

const visiblePages = computed<(number | 'ellipsis')[]>(() => {
  const total = pageCount.value;
  const current = props.page;
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  if (start > 2) {
    items.push('ellipsis');
  }
  for (let index = start; index <= end; index += 1) {
    items.push(index);
  }
  if (end < total - 1) {
    items.push('ellipsis');
  }
  items.push(total);
  return items;
});

function go(page: number): void {
  if (props.disabled || page < 1 || page > pageCount.value || page === props.page) {
    return;
  }
  emit('change', page);
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
    <span class="text-xs text-muted-foreground">
      共 <b class="text-foreground">{{ props.total }}</b> 条，第 {{ props.page }} / {{ pageCount }} 页
    </span>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        class="size-8 p-0"
        :disabled="props.disabled || props.page <= 1"
        @click="go(props.page - 1)"
      >
        <ChevronLeft class="size-4" />
      </Button>
      <template v-for="(item, index) in visiblePages" :key="`${item}-${index}`">
        <span v-if="item === 'ellipsis'" class="px-1 text-xs text-muted-foreground">…</span>
        <Button
          v-else
          :variant="item === props.page ? 'default' : 'ghost'"
          size="sm"
          class="size-8 p-0 text-xs"
          :disabled="props.disabled"
          @click="go(item)"
        >
          {{ item }}
        </Button>
      </template>
      <Button
        variant="ghost"
        size="sm"
        class="size-8 p-0"
        :disabled="props.disabled || props.page >= pageCount"
        @click="go(props.page + 1)"
      >
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>
