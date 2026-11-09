<script setup lang="ts">
import { cn, Popover, PopoverContent, PopoverTrigger } from '@cloudhub/ui';
import { Check, Loader2, Plus, X } from 'lucide-vue-next';
import { computed, nextTick, ref, useId, watch } from 'vue';

import type { MultiSelectOption } from './types';

const props = withDefaults(
  defineProps<{
    options: MultiSelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    maxChips?: number;
    disabled?: boolean;
    loading?: boolean;
    emptyText?: string;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: '尚未选择',
    searchPlaceholder: '搜索',
    maxChips: 4,
    disabled: false,
    loading: false,
    emptyText: '无匹配项',
    id: undefined,
    ariaLabel: undefined,
  },
);

const model = defineModel<number[]>({ default: () => [] });

const triggerId = useId();
const listboxId = useId();
const open = ref(false);
const keyword = ref('');
const searchRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const activeIndex = ref(-1);

/** 已选值即使暂时不在 options 中（加载中/加载失败）也保留占位，避免静默隐藏。 */
const selectedOptions = computed<MultiSelectOption[]>(() => {
  const map = new Map(props.options.map((option) => [option.value, option]));
  return model.value.map(
    (value) => map.get(value) ?? { value, label: `选项 #${value}` },
  );
});

const visibleChips = computed(() => selectedOptions.value.slice(0, props.maxChips));
const hiddenCount = computed(() => Math.max(0, selectedOptions.value.length - props.maxChips));

const filteredOptions = computed(() => {
  const lowered = keyword.value.trim().toLowerCase();
  if (!lowered) {
    return props.options;
  }
  return props.options.filter((option) =>
    [option.label, option.group ?? '', option.hint ?? '']
      .join(' ')
      .toLowerCase()
      .includes(lowered),
  );
});

const activeOption = computed<MultiSelectOption | undefined>(
  () => filteredOptions.value[activeIndex.value],
);

function groupFor(index: number): string | undefined {
  const option = filteredOptions.value[index];
  const previous = filteredOptions.value[index - 1];
  if (!option?.group || option.group === previous?.group) {
    return undefined;
  }
  return option.group;
}

function optionDomId(value: number): string {
  return `${listboxId}-option-${value}`;
}

function isSelected(value: number): boolean {
  return model.value.includes(value);
}

function toggleOpen(): void {
  if (props.disabled) {
    return;
  }
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function toggleOption(value: number): void {
  if (props.disabled) {
    return;
  }
  const next = isSelected(value)
    ? model.value.filter((item) => item !== value)
    : [...model.value, value];
  model.value = next;
}

function removeOption(value: number): void {
  if (props.disabled) {
    return;
  }
  model.value = model.value.filter((item) => item !== value);
}

function clearAll(): void {
  if (!props.disabled) {
    model.value = [];
  }
}

function scrollActiveIntoView(): void {
  const element = listRef.value?.querySelector<HTMLElement>(
    `[data-option-index="${activeIndex.value}"]`,
  );
  element?.scrollIntoView({ block: 'nearest' });
}

function moveActive(delta: number): void {
  if (!open.value) {
    open.value = true;
    return;
  }
  const total = filteredOptions.value.length;
  if (!total) {
    activeIndex.value = -1;
    return;
  }
  const next = Math.min(Math.max(activeIndex.value + delta, 0), total - 1);
  activeIndex.value = next;
  void nextTick(scrollActiveIntoView);
}

function selectActive(): void {
  const option = filteredOptions.value[activeIndex.value];
  if (option) {
    toggleOption(option.value);
  }
}

/** 中文输入法确认候选词时不应触发选项选择。 */
function handleSearchEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  event.preventDefault();
  selectActive();
}

function handleOpenAutoFocus(event: Event): void {
  event.preventDefault();
  void nextTick(() => searchRef.value?.focus());
}

watch(open, (value) => {
  if (!value) {
    keyword.value = '';
    activeIndex.value = -1;
    return;
  }
  keyword.value = '';
  const selectedIndex = filteredOptions.value.findIndex((option) => isSelected(option.value));
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : filteredOptions.value.length ? 0 : -1;
  void nextTick(scrollActiveIntoView);
});

watch(keyword, () => {
  activeIndex.value = filteredOptions.value.length ? 0 : -1;
  void nextTick(scrollActiveIntoView);
});

watch(
  () => props.options.length,
  () => {
    if (activeIndex.value < 0 && filteredOptions.value.length) {
      activeIndex.value = 0;
    } else if (activeIndex.value >= filteredOptions.value.length) {
      activeIndex.value = filteredOptions.value.length ? 0 : -1;
    }
  },
);
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <div
        :id="props.id ?? triggerId"
        role="combobox"
        :aria-expanded="open"
        :aria-controls="open ? listboxId : undefined"
        :aria-label="props.ariaLabel"
        :aria-disabled="props.disabled || undefined"
        aria-haspopup="listbox"
        :tabindex="props.disabled ? -1 : 0"
        class="flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        :class="
          cn(
            open && 'border-ring ring-[3px] ring-ring/50',
            props.disabled && 'pointer-events-none cursor-not-allowed opacity-50',
          )
        "
        @keydown.down.prevent="open = true"
        @keydown.up.prevent="open = true"
        @keydown.enter.self.prevent="toggleOpen"
        @keydown.space.self.prevent="toggleOpen"
      >
        <span v-if="!selectedOptions.length" class="px-1 text-muted-foreground">
          {{ props.loading ? '正在加载选项…' : props.placeholder }}
        </span>
        <span
          v-for="option in visibleChips"
          :key="option.value"
          class="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
        >
          <span class="max-w-40 truncate">{{ option.label }}</span>
          <button
            type="button"
            class="rounded p-0.5 text-muted-foreground hover:text-foreground"
            title="移除"
            :disabled="props.disabled"
            :tabindex="props.disabled ? -1 : undefined"
            @click.stop="removeOption(option.value)"
          >
            <X class="size-3" />
          </button>
        </span>
        <span v-if="hiddenCount > 0" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          +{{ hiddenCount }}
        </span>
        <span class="ml-auto inline-flex shrink-0 items-center gap-1 px-1 text-xs text-primary">
          <Plus class="size-3.5" />
          选择
        </span>
      </div>
    </PopoverTrigger>

    <PopoverContent
      class="flex max-h-[min(26rem,var(--reka-popper-available-height))] w-(--reka-popper-anchor-width) flex-col overflow-hidden p-0"
      :collision-padding="8"
      @open-auto-focus="handleOpenAutoFocus"
    >
      <div class="flex min-h-0 flex-1 flex-col" @keydown.esc.stop.prevent="close">
        <div class="flex items-center gap-2 border-b px-2 py-2">
          <input
            ref="searchRef"
            v-model="keyword"
            role="combobox"
            aria-autocomplete="list"
            :aria-label="props.searchPlaceholder"
            :aria-controls="listboxId"
            aria-expanded="true"
            :aria-activedescendant="activeOption ? optionDomId(activeOption.value) : undefined"
            :placeholder="props.searchPlaceholder"
            class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            @keydown.down.prevent="moveActive(1)"
            @keydown.up.prevent="moveActive(-1)"
            @keydown.enter="handleSearchEnter"
            @keydown.esc.stop.prevent="close"
          />
          <button
            v-if="selectedOptions.length"
            type="button"
            class="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            @click="clearAll"
          >
            清空
          </button>
        </div>

        <div v-if="props.loading" class="flex items-center justify-center gap-2 px-2 py-6 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" />
          正在加载选项…
        </div>

        <div
          v-else
          :id="listboxId"
          ref="listRef"
          role="listbox"
          aria-multiselectable="true"
          class="min-h-0 flex-1 overflow-y-auto p-1"
        >
          <template v-for="(option, index) in filteredOptions" :key="option.value">
            <div
              v-if="groupFor(index)"
              role="presentation"
              class="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground"
            >
              {{ groupFor(index) }}
            </div>
            <button
              :id="optionDomId(option.value)"
              type="button"
              role="option"
              tabindex="-1"
              :data-option-index="index"
              :aria-selected="isSelected(option.value)"
              class="flex w-full scroll-m-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none"
              :class="
                cn(
                  'hover:bg-accent',
                  isSelected(option.value) && 'bg-accent/60 text-accent-foreground',
                  index === activeIndex && 'bg-accent text-accent-foreground',
                )
              "
              @mouseenter="activeIndex = index"
              @mousedown.prevent
              @click="toggleOption(option.value)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded border"
                :class="isSelected(option.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Check v-if="isSelected(option.value)" class="size-3" />
              </span>
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <span v-if="option.hint" class="shrink-0 text-[11px] text-muted-foreground">
                {{ option.hint }}
              </span>
            </button>
          </template>
          <div v-if="!filteredOptions.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
            {{ props.emptyText }}
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
