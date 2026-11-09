import type { Component } from 'vue';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDot,
  FileText,
  Folder,
  KeyRound,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-vue-next';
import { markRaw } from 'vue';

export interface MenuIconOption {
  key: string;
  name: string;
  component: Component;
}

const OPTIONS: MenuIconOption[] = [
  { key: 'settings', name: '设置', component: markRaw(Settings) },
  { key: 'users', name: '用户', component: markRaw(Users) },
  { key: 'user', name: '人员', component: markRaw(UserRound) },
  { key: 'building', name: '组织', component: markRaw(Building2) },
  { key: 'briefcase', name: '岗位', component: markRaw(BriefcaseBusiness) },
  { key: 'shield', name: '权限', component: markRaw(ShieldCheck) },
  { key: 'key', name: '密钥', component: markRaw(KeyRound) },
  { key: 'menu', name: '菜单', component: markRaw(Menu) },
  { key: 'log', name: '日志', component: markRaw(ScrollText) },
  { key: 'dashboard', name: '工作台', component: markRaw(LayoutDashboard) },
  { key: 'calendar', name: '日历', component: markRaw(CalendarDays) },
  { key: 'folder', name: '目录', component: markRaw(Folder) },
  { key: 'file', name: '文件', component: markRaw(FileText) },
  { key: 'dot', name: '标记', component: markRaw(CircleDot) },
];

export const MENU_ICON_OPTIONS: MenuIconOption[] = OPTIONS;

const ICON_MAP = new Map(OPTIONS.map((item) => [item.key, item.component]));

/** 根据 sys_menu.icon 的字符串标识解析图标组件。 */
export function resolveMenuIcon(key: string): Component | null {
  return ICON_MAP.get(key) ?? null;
}
