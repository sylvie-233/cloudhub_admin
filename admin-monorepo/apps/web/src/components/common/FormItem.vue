<script setup lang="ts">
import { Label } from '@cloudhub/ui';

defineProps<{
  label: string;
  for?: string;
  required?: boolean;
  hint?: string;
  error?: string;
}>();
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="$props.for">
      {{ $props.label }}
      <span v-if="$props.required" class="text-destructive">*</span>
    </Label>
    <slot />
    <p v-if="$props.error" class="text-xs text-destructive">{{ $props.error }}</p>
    <p v-else-if="$props.hint" class="text-[11px] leading-relaxed text-muted-foreground">
      {{ $props.hint }}
    </p>
  </div>
</template>
