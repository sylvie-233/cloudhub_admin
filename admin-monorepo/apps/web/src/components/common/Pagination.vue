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

/** 请求失败等情况可能留下越界页码，展示与按钮统一按合法范围收敛。 */
const currentPage = computed(() => Math.min(Math.max(1, props.page), pageCount.value));

const visiblePages = computed<(number | 'ellipsis')[]>(() => {
  const total = pageCount.value;
  const current = currentPage.value;
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
  if (props.disabled || page < 1 || page > pageCount.value || page === currentPage.value) {
    return;
  }
  emit('change', page);
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
    <span class="text-xs text-muted-foreground">
      共 <b class="text-foreground">{{ props.total }}</b> 条，第 {{ currentPage }} / {{ pageCount }} 页
    </span>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        class="size-8 p-0"
        :disabled="props.disabled || currentPage <= 1"
        aria-label="上一页"
        @click="go(currentPage - 1)"
      >
        <ChevronLeft class="size-4" />
      </Button>
      <template v-for="(item, index) in visiblePages" :key="`${item}-${index}`">
        <span v-if="item === 'ellipsis'" class="px-1 text-xs text-muted-foreground">…</span>
        <Button
          v-else
          :variant="item === currentPage ? 'default' : 'ghost'"
          size="sm"
          class="size-8 p-0 text-xs"
          :aria-current="item === currentPage ? 'page' : undefined"
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
        :disabled="props.disabled || currentPage >= pageCount"
        aria-label="下一页"
        @click="go(currentPage + 1)"
      >
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>
