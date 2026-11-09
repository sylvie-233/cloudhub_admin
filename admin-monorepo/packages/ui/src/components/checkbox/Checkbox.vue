<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui';
import { computed } from 'vue';
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui';
import { Check, Minus } from 'lucide-vue-next';

import { cn } from '../../lib/utils';

const props = defineProps<
  CheckboxRootProps & {
    class?: HTMLAttributes['class'];
    /** 半选状态；Reka UI 以 modelValue='indeterminate' 表达。 */
    indeterminate?: boolean;
  }
>();
const emits = defineEmits<CheckboxRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
const isIndeterminate = computed(
  () => Boolean(props.indeterminate) || props.modelValue === 'indeterminate',
);
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :model-value="isIndeterminate ? 'indeterminate' : props.modelValue"
    :class="
      cn(
        'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Minus v-if="isIndeterminate" class="size-3.5" />
      <Check v-else class="size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
