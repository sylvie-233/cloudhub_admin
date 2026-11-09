import type { Component } from 'vue';

import { normalizeViewComponentPath } from '@/utils/format';

/** 页面组件清单：菜单的 component 字段必须能在这里找到对应文件。 */
const VIEW_MODULES = import.meta.glob<Component>('../views/**/*.vue');

/** 把组件路径转换为 import.meta.glob 的 key；无效路径返回 null。 */
function toViewModuleKey(component: string | null | undefined): string | null {
  let key = normalizeViewComponentPath(component);
  if (!key) {
    return null;
  }
  if (key.startsWith('views/')) {
    key = key.slice('views/'.length);
  }
  if (!key.endsWith('.vue')) {
    key = `${key}.vue`;
  }
  return `../views/${key}`;
}

/** 解析菜单组件为懒加载组件；路径不存在时返回 null。 */
export function resolveViewComponent(
  component: string | null | undefined,
): (() => Promise<Component>) | null {
  const key = toViewModuleKey(component);
  return key ? (VIEW_MODULES[key] ?? null) : null;
}

/** 判断菜单配置的组件文件是否真实存在。 */
export function hasViewComponent(component: string | null | undefined): boolean {
  return resolveViewComponent(component) !== null;
}
