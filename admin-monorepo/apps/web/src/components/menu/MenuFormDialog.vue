<script setup lang="ts">
import type { Menu, MenuTreeNode, MenuType, Status } from '@cloudhub/types';
import { MENU_TYPE_LABELS, RESERVED_MENU_PATHS } from '@cloudhub/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cloudhub/ui';
import { Check, Loader2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import FormItem from '@/components/common/FormItem.vue';
import { collectMenuIds, flattenMenuTree, normalizeMenuPath } from '@/utils/format';
import { MENU_ICON_OPTIONS, resolveMenuIcon } from '@/utils/icons';
import { hasViewComponent } from '@/utils/view-components';

const props = withDefaults(
  defineProps<{
    menu: Menu | null;
    menus: MenuTreeNode[];
    menusLoading?: boolean;
    menusError?: string;
    defaultParentId?: number | null;
    saving?: boolean;
    error?: string;
  }>(),
  { menusLoading: false, menusError: '', defaultParentId: null, saving: false, error: '' },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [
    payload: {
      menuId?: number;
      parentId: number;
      menuName: string;
      orderNum: number;
      path: string;
      component: string | null;
      menuType: MenuType;
      status: Status;
      perms: string | null;
      icon: string;
    },
  ];
}>();

const form = ref({
  parentId: '0',
  menuName: '',
  orderNum: '0',
  path: '',
  component: '',
  menuType: 'C' as MenuType,
  status: '0' as Status,
  perms: '',
  icon: 'dot',
});
const localError = ref('');

const isEdit = computed(() => Boolean(props.menu?.menuId));
const displayError = computed(() => props.error || localError.value);
const typeOptions = (['M', 'C', 'F'] as MenuType[]).map((value) => ({
  value,
  label: MENU_TYPE_LABELS[value],
}));

const editingNode = computed(() => {
  if (!props.menu?.menuId) {
    return null;
  }
  const targetId = props.menu.menuId;
  const find = (nodes: MenuTreeNode[]): MenuTreeNode | null => {
    for (const node of nodes) {
      if (node.menuId === targetId) {
        return node;
      }
      const found = find(node.children);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return find(props.menus);
});

const excludedIds = computed(() => {
  if (!editingNode.value) {
    return new Set<number>();
  }
  return new Set(collectMenuIds(editingNode.value));
});

const parentOptions = computed(() =>
  flattenMenuTree(props.menus).filter(
    (row) => row.menu.menuType !== 'F' && !excludedIds.value.has(row.menu.menuId),
  ),
);

const selectedIcon = computed(() => resolveMenuIcon(form.value.icon));

function init(): void {
  localError.value = '';
  if (props.menu) {
    form.value = {
      parentId: String(props.menu.parentId),
      menuName: props.menu.menuName,
      orderNum: String(props.menu.orderNum),
      path: props.menu.path,
      component: props.menu.component ?? '',
      menuType: props.menu.menuType,
      status: props.menu.status,
      perms: props.menu.perms ?? '',
      icon: props.menu.icon || 'dot',
    };
  } else {
    form.value = {
      parentId: String(props.defaultParentId ?? 0),
      menuName: '',
      orderNum: '0',
      path: '',
      component: '',
      menuType: 'C',
      status: '0',
      perms: '',
      icon: 'dot',
    };
  }
}

function handleSubmit(): void {
  const menuName = form.value.menuName.trim();
  const menuType = form.value.menuType;
  const path = normalizeMenuPath(form.value.path);
  const component = form.value.component.trim();
  const orderNum = Number(form.value.orderNum);

  if (!menuName) {
    localError.value = '请输入菜单名称';
    return;
  }

  if (!form.value.orderNum.trim() || !Number.isInteger(orderNum) || orderNum < 0) {
    localError.value = '显示顺序必须为不小于 0 的整数';
    return;
  }

  if (menuType === 'F' && editingNode.value?.children.length) {
    localError.value = '存在下级节点时不能改为动作类型，请先调整或删除下级菜单';
    return;
  }

  if (menuType === 'C') {
    if (!path) {
      localError.value = '菜单类型必须填写路由地址';
      return;
    }
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) {
      localError.value = '路由地址只能包含字母、数字、下划线、短横线，可用 / 分隔层级';
      return;
    }
    if (RESERVED_MENU_PATHS.some((reserved) => reserved === path.toLowerCase())) {
      localError.value = `路由地址 /${path} 是内置静态页面，请换一个地址`;
      return;
    }
    if (!component) {
      localError.value = '菜单类型必须填写组件路径';
      return;
    }
    if (!hasViewComponent(component)) {
      localError.value = `组件 ${component} 不存在，请确认 views 目录下的文件路径`;
      return;
    }
    const conflict = flattenMenuTree(props.menus).find(
      (row) =>
        row.menu.menuType === 'C' &&
        row.menu.menuId !== props.menu?.menuId &&
        normalizeMenuPath(row.menu.path).toLowerCase() === path.toLowerCase(),
    );
    if (conflict) {
      localError.value = `路由地址 /${path} 已被菜单「${conflict.menu.menuName}」占用`;
      return;
    }
  }

  if (menuType !== 'M' && !form.value.perms.trim()) {
    localError.value = '菜单与动作类型必须填写权限标识';
    return;
  }

  localError.value = '';
  emit('submit', {
    menuId: props.menu?.menuId,
    parentId: Number(form.value.parentId),
    menuName,
    orderNum,
    // 切换类型后隐藏字段仍保留原值，提交时按类型清理，避免目录/动作写入无关数据
    path: menuType === 'C' ? path : '',
    component: menuType === 'C' ? component : null,
    menuType,
    status: form.value.status,
    perms: menuType === 'M' ? null : form.value.perms.trim(),
    icon: form.value.icon,
  });
}

watch(
  [() => open.value, () => props.menu],
  () => {
    if (open.value) {
      init();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[92vh] max-w-2xl overflow-y-auto"
      :close-disabled="props.saving"
    >
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑菜单' : '新增菜单' }}</DialogTitle>
        <DialogDescription>
          目录 M 仅作导航分组；菜单 C 的路由地址与组件路径决定前端页面；动作 F 只提供后端鉴权点。
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormItem label="菜单名称" for="menu-name" required>
          <Input id="menu-name" v-model="form.menuName" placeholder="如：用户查询" maxlength="50" />
        </FormItem>

        <FormItem label="菜单类型" for="menu-type" required>
          <Select v-model="form.menuType">
            <SelectTrigger id="menu-type" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem
          label="上级菜单"
          for="menu-parent"
          hint="动作节点不能作为上级菜单"
        >
          <Select v-model="form.parentId" :disabled="props.menusLoading">
            <SelectTrigger id="menu-parent" class="w-full">
              <SelectValue placeholder="选择上级菜单" />
            </SelectTrigger>
            <SelectContent class="max-h-72">
              <SelectItem value="0">顶级菜单</SelectItem>
              <SelectItem
                v-for="row in parentOptions"
                :key="row.menu.menuId"
                :value="String(row.menu.menuId)"
              >
                {{ String.fromCharCode(0x3000).repeat(row.level) }}{{ row.menu.menuName }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="props.menusLoading" class="mt-1 text-[11px] text-muted-foreground">
            正在加载菜单树…
          </p>
          <p v-else-if="props.menusError" class="mt-1 text-[11px] text-destructive">
            菜单树加载失败：{{ props.menusError }}，上级菜单可能不完整
          </p>
        </FormItem>

        <FormItem label="显示顺序" for="menu-order" hint="数字越小越靠前">
          <Input id="menu-order" v-model="form.orderNum" type="number" min="0" />
        </FormItem>

        <FormItem
          v-if="form.menuType === 'C'"
          label="路由地址"
          for="menu-path"
          required
          hint="布局下一级地址，如 users 对应 /users"
        >
          <Input id="menu-path" v-model="form.path" placeholder="如：users" maxlength="200" />
        </FormItem>

        <FormItem
          v-if="form.menuType === 'C'"
          label="组件路径"
          for="menu-component"
          required
          hint="views 目录下的 .vue 文件，如 views/UserView.vue"
        >
          <Input
            id="menu-component"
            v-model="form.component"
            placeholder="如：views/UserView.vue"
            maxlength="255"
          />
        </FormItem>

        <FormItem
          v-if="form.menuType !== 'M'"
          label="权限标识"
          for="menu-perms"
          required
          hint="格式：模块:实体:动作，例如 system:user:list"
        >
          <Input
            id="menu-perms"
            v-model="form.perms"
            placeholder="system:user:list"
            maxlength="100"
          />
        </FormItem>

        <FormItem label="状态" for="menu-status">
          <Select v-model="form.status">
            <SelectTrigger id="menu-status" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="菜单图标" class="sm:col-span-2" hint="仅目录与菜单展示图标">
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <span class="flex size-8 items-center justify-center rounded-md border bg-muted">
                <component :is="selectedIcon" v-if="selectedIcon" class="size-4" />
                <span v-else class="text-xs text-muted-foreground">无</span>
              </span>
              <span class="text-xs text-muted-foreground">
                {{ form.icon ? `当前：${form.icon}` : '未选择图标' }}
              </span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in MENU_ICON_OPTIONS"
                :key="option.key"
                type="button"
                class="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
                :class="
                  form.icon === option.key
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border hover:border-primary/30'
                "
                :aria-pressed="form.icon === option.key"
                :aria-label="`选择图标：${option.name}`"
                @click="form.icon = option.key"
              >
                <component :is="option.component" class="size-3.5" />
                {{ option.name }}
                <Check v-if="form.icon === option.key" class="size-3 text-primary" />
              </button>
            </div>
          </div>
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
          {{ isEdit ? '保存修改' : '创建菜单' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
