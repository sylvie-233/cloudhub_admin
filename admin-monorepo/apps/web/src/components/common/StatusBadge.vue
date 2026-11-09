<script setup lang="ts">
import type { Status } from '@cloudhub/types';
import { Badge } from '@cloudhub/ui';

const props = withDefaults(
  defineProps<{
    status: Status;
    trueText?: string;
    falseText?: string;
    /** 失败态使用灰色还是红色 */
    falseVariant?: 'muted' | 'destructive';
  }>(),
  {
    trueText: '正常',
    falseText: '停用',
    falseVariant: 'muted',
  },
);
</script>

<template>
  <Badge
    :variant="
      props.status === '0'
        ? 'success'
        : props.falseVariant === 'destructive'
          ? 'destructive'
          : 'muted'
    "
  >
    {{ props.status === '0' ? props.trueText : props.falseText }}
  </Badge>
</template>
