<script setup lang="ts">
import type {
  DataScope,
  MenuTreeNode,
  OrgTreeNode,
  PostTreeNode,
  RoleListItem,
  RolePermissionDetail,
  SubjectPermissionDetail,
} from '@cloudhub/types';
import { DATA_SCOPE_LABELS, PERMS } from '@cloudhub/types';
import { Badge, Button, cn, toast } from '@cloudhub/ui';
import {
  AlertCircle,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

import { menuApi, orgApi, permApi, postApi, roleApi } from '@/api';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import DataScopePanel from '@/components/permission/DataScopePanel.vue';
import PermissionTree from '@/components/permission/PermissionTree.vue';
import { useAuthStore } from '@/stores/auth';
import { flattenOrgTree, flattenPostTree } from '@/utils/format';

type Tab = 'postorg' | 'role';
type SubjectType = 'org' | 'post';
type RoleRightTab = 'menu' | 'data';

interface LeftRow {
  kind: 'org' | 'post';
  key: string;
  level: number;
  org: OrgTreeNode;
  post?: PostTreeNode;
  expandable: boolean;
}

const auth = useAuthStore();
const route = useRoute();

/* ==================== 授权对象数据 ==================== */
const menuTree = ref<MenuTreeNode[]>([]);
const orgTree = ref<OrgTreeNode[]>([]);
const roles = ref<RoleListItem[]>([]);
const postsByOrg = ref<Record<number, PostTreeNode[]>>({});
const baseLoading = ref(false);
const baseError = ref('');
const menuError = ref('');
const postNotice = ref('');

const canLoadMenus = computed(
  () => auth.hasPerm(PERMS.MENU_LIST) || auth.hasPerm(PERMS.PERM_QUERY),
);
const canLoadOrgs = computed(() => auth.hasPerm(PERMS.ORG_LIST));
const canLoadRoles = computed(
  () => auth.hasPerm(PERMS.ROLE_LIST) || auth.hasPerm(PERMS.PERM_QUERY),
);
const canLoadPosts = computed(() => auth.hasPerm(PERMS.POST_QUERY));

const activeTab = ref<Tab>('postorg');
const subjectType = ref<SubjectType>('org');
const selectedOrgId = ref<number | null>(null);
const selectedPostId = ref<number | null>(null);
const selectedRoleId = ref<number | null>(null);
const roleRightTab = ref<RoleRightTab>('menu');
const roleKeyword = ref('');
const collapsedOrgs = ref<Set<number>>(new Set());

const orgRows = computed(() => flattenOrgTree(orgTree.value));

const postRowsByOrg = computed(() => {
  const map = new Map<number, ReturnType<typeof flattenPostTree>>();
  for (const [orgId, tree] of Object.entries(postsByOrg.value)) {
    map.set(Number(orgId), flattenPostTree(tree));
  }
  return map;
});

const leftRows = computed<LeftRow[]>(() => {
  const rows: LeftRow[] = [];
  const postMap = postRowsByOrg.value;
  let hiddenLevel = Number.POSITIVE_INFINITY;

  for (const orgRow of orgRows.value) {
    if (orgRow.level >= hiddenLevel) {
      continue;
    }
    hiddenLevel = Number.POSITIVE_INFINITY;

    const posts = postMap.get(orgRow.org.orgId) ?? [];
    rows.push({
      kind: 'org',
      key: `org-${orgRow.org.orgId}`,
      level: orgRow.level,
      org: orgRow.org,
      expandable: orgRow.hasChildren || posts.length > 0,
    });

    if (collapsedOrgs.value.has(orgRow.org.orgId)) {
      if (orgRow.hasChildren) {
        hiddenLevel = orgRow.level + 1;
      }
      continue;
    }

    for (const postRow of posts) {
      rows.push({
        kind: 'post',
        key: `post-${postRow.post.postId}`,
        level: orgRow.level + 1 + postRow.level,
        org: orgRow.org,
        post: postRow.post,
        expandable: false,
      });
    }
  }

  return rows;
});

const allPostRows = computed(() =>
  Object.values(postsByOrg.value).flatMap((tree) =>
    flattenPostTree(tree).map((row) => row.post),
  ),
);

const selectedOrgRow = computed(
  () => orgRows.value.find((row) => row.org.orgId === selectedOrgId.value) ?? null,
);

const selectedPost = computed(
  () => allPostRows.value.find((post) => post.postId === selectedPostId.value) ?? null,
);

const selectedRole = computed(
  () => roles.value.find((role) => role.roleId === selectedRoleId.value) ?? null,
);

const filteredRoles = computed(() => {
  const lowered = roleKeyword.value.trim().toLowerCase();
  if (!lowered) {
    return roles.value;
  }
  return roles.value.filter((role) =>
    `${role.roleName} ${role.roleKey}`.toLowerCase().includes(lowered),
  );
});

function toggleOrgCollapse(orgId: number): void {
  const next = new Set(collapsedOrgs.value);
  if (next.has(orgId)) {
    next.delete(orgId);
  } else {
    next.add(orgId);
  }
  collapsedOrgs.value = next;
}

function isOrgSelected(orgId: number): boolean {
  return activeTab.value === 'postorg' && subjectType.value === 'org' && selectedOrgId.value === orgId;
}

function isPostSelected(postId: number): boolean {
  return activeTab.value === 'postorg' && subjectType.value === 'post' && selectedPostId.value === postId;
}

function isRoleSelected(roleId: number): boolean {
  return activeTab.value === 'role' && selectedRoleId.value === roleId;
}

/* ==================== 权限详情草稿 ==================== */
const roleDetail = ref<RolePermissionDetail | null>(null);
const subjectDetail = ref<SubjectPermissionDetail | null>(null);
const menuIds = ref<number[]>([]);
const dataScope = ref<DataScope>('5');
const scopeOrgIds = ref<number[]>([]);
const detailLoading = ref(false);
const detailError = ref('');
let detailRequestId = 0;

const isRole = computed(() => activeTab.value === 'role');
const isDataTab = computed(() => isRole.value && roleRightTab.value === 'data');
const hasSelection = computed(() => {
  if (isRole.value) {
    return selectedRoleId.value !== null;
  }
  return subjectType.value === 'post'
    ? selectedPostId.value !== null
    : selectedOrgId.value !== null;
});
const hasDetail = computed(() =>
  isRole.value ? Boolean(roleDetail.value) : Boolean(subjectDetail.value),
);
const currentLocked = computed(() =>
  isRole.value ? (roleDetail.value?.locked ?? selectedRoleId.value === 1) : false,
);
const canSaveMenus = computed(() => auth.hasPerm(PERMS.PERM_SAVE));
const canSaveScope = computed(() => auth.hasPerm(PERMS.PERM_DATA_SCOPE));
const canQueryPerm = computed(() => auth.hasPerm(PERMS.PERM_QUERY));
const savingMenus = ref(false);
const savingScope = ref(false);
const isBusy = computed(() => savingMenus.value || savingScope.value);
const canEditCurrent = computed(() =>
  isDataTab.value ? canSaveScope.value : canSaveMenus.value,
);

const emptySelectionText = computed(() => {
  if (isRole.value) {
    return canLoadRoles.value
      ? '暂无可配置的角色，请先在角色管理中创建角色'
      : '当前账号缺少角色查询权限，无法选择角色';
  }
  return canLoadOrgs.value
    ? '暂无可配置的组织，请先在组织管理中创建组织'
    : '当前账号缺少组织查询权限，无法选择组织或岗位';
});

const menuEmptyText = computed(() => {
  if (!canLoadMenus.value) {
    return '当前账号缺少菜单查询权限，无法加载可授权菜单';
  }
  if (menuError.value) {
    return `菜单树加载失败：${menuError.value}`;
  }
  return '菜单树为空，请先在菜单管理中维护';
});

const subjectTitle = computed(() => {
  if (isRole.value) {
    return roleDetail.value?.roleName ?? selectedRole.value?.roleName ?? '角色权限';
  }
  if (subjectType.value === 'post') {
    return subjectDetail.value?.name ?? selectedPost.value?.postName ?? '岗位权限';
  }
  return subjectDetail.value?.name ?? selectedOrgRow.value?.org.orgName ?? '组织权限';
});

const subjectSub = computed(() => {
  if (isRole.value) {
    return roleDetail.value?.roleKey ?? selectedRole.value?.roleKey ?? '';
  }
  if (subjectType.value === 'post') {
    return subjectDetail.value?.sub ?? selectedOrgRow.value?.path ?? '';
  }
  return selectedOrgRow.value
    ? `${selectedOrgRow.value.org.orgCode} · ${selectedOrgRow.value.path}`
    : '';
});

const subjectTag = computed(() => (isRole.value ? '角色' : subjectType.value === 'post' ? '岗位' : '组织'));
const subjectTagVariant = computed<'secondary' | 'outline' | 'success'>(() =>
  isRole.value ? 'secondary' : subjectType.value === 'post' ? 'outline' : 'success',
);

const subjectNote = computed(() => {
  if (isRole.value) {
    return currentLocked.value
      ? '系统内置角色拥有全部菜单权限，授权与数据范围均被锁定。'
      : '角色功能权限写入 sys_role_menu，仅授予直接拥有该角色的用户；数据范围仅由角色携带。';
  }
  if (subjectType.value === 'post') {
    return '岗位直授权限写入 sys_post_menu，对该岗位全部在岗人员生效，与汇报线上下级无关。';
  }
  return '组织直授权限写入 sys_org_menu，沿组织树向下继承，对所有下级组织的在岗人员生效。';
});

/* ==================== 数据加载 ==================== */
async function loadBaseData(): Promise<boolean> {
  baseLoading.value = true;
  baseError.value = '';
  menuError.value = '';
  postNotice.value = '';
  const errors: string[] = [];

  // 按当前账号实际拥有的查询权限发起请求，避免进入页面即产生 403。
  const [menuResult, orgResult, roleResult] = await Promise.allSettled([
    canLoadMenus.value ? menuApi.tree() : Promise.resolve<MenuTreeNode[]>([]),
    canLoadOrgs.value ? orgApi.list() : Promise.resolve<OrgTreeNode[]>([]),
    canLoadRoles.value ? roleApi.list() : Promise.resolve<RoleListItem[]>([]),
  ]);

  const menuOk = menuResult.status === 'fulfilled';
  const orgOk = orgResult.status === 'fulfilled';
  const roleOk = roleResult.status === 'fulfilled';

  if (menuOk) {
    menuTree.value = menuResult.value;
  } else {
    const message = menuResult.reason instanceof Error ? menuResult.reason.message : '菜单树加载失败';
    menuError.value = message;
    errors.push(message);
  }

  if (orgOk) {
    orgTree.value = orgResult.value;
  } else {
    errors.push(orgResult.reason instanceof Error ? orgResult.reason.message : '组织树加载失败');
  }

  if (roleOk) {
    roles.value = roleResult.value;
  } else {
    errors.push(roleResult.reason instanceof Error ? roleResult.reason.message : '角色列表加载失败');
  }

  const flatOrgs = flattenOrgTree(orgTree.value);
  const postResults = canLoadPosts.value
    ? await Promise.allSettled(flatOrgs.map((row) => postApi.list(row.org.orgId)))
    : [];
  const postMap: Record<number, PostTreeNode[]> = {};
  let failedPostCount = 0;
  postResults.forEach((result, index) => {
    const orgId = flatOrgs[index]?.org.orgId;
    if (!orgId) {
      return;
    }
    if (result.status === 'fulfilled') {
      postMap[orgId] = result.value;
    } else {
      failedPostCount += 1;
    }
  });
  postsByOrg.value = postMap;

  // 仅在对应列表成功刷新时校正选择，避免网络异常时清空当前授权对象。
  if (orgOk) {
    const orgExists =
      selectedOrgId.value !== null && flatOrgs.some((row) => row.org.orgId === selectedOrgId.value);
    if (!orgExists) {
      selectedOrgId.value = flatOrgs[0]?.org.orgId ?? null;
      if (subjectType.value === 'org' && !selectedOrgId.value) {
        selectedPostId.value = null;
      }
    }
  }

  if (roleOk) {
    const roleExists =
      selectedRoleId.value !== null &&
      roles.value.some((role) => role.roleId === selectedRoleId.value);
    if (!roleExists) {
      selectedRoleId.value = roles.value[0]?.roleId ?? null;
    }
  }

  // 岗位分页只要有一页失败就无法确认选择是否仍存在，此时保留原选择与详情。
  if (canLoadPosts.value && failedPostCount === 0) {
    const postExists =
      selectedPostId.value !== null &&
      allPostRows.value.some((post) => post.postId === selectedPostId.value);
    if (!postExists) {
      selectedPostId.value = null;
      if (subjectType.value === 'post') {
        subjectType.value = 'org';
      }
    }
  }

  if (failedPostCount > 0) {
    postNotice.value = `${failedPostCount} 个组织的岗位数据加载失败，岗位树可能不完整`;
  } else if (!canLoadPosts.value) {
    postNotice.value = '当前账号缺少岗位查询权限，岗位节点未加载';
  }

  if (errors.length) {
    baseError.value = errors[0] ?? '权限基础数据加载失败';
  }

  baseLoading.value = false;
  return errors.length === 0 && failedPostCount === 0;
}

async function loadPermissionDetail(): Promise<boolean> {
  if (!canQueryPerm.value) {
    detailRequestId += 1;
    roleDetail.value = null;
    subjectDetail.value = null;
    menuIds.value = [];
    detailLoading.value = false;
    detailError.value = '当前账号缺少权限查询权限';
    return false;
  }

  if (!hasSelection.value) {
    detailRequestId += 1;
    roleDetail.value = null;
    subjectDetail.value = null;
    menuIds.value = [];
    detailLoading.value = false;
    detailError.value = '';
    return false;
  }

  const requestId = ++detailRequestId;
  detailLoading.value = true;
  detailError.value = '';
  roleDetail.value = null;
  subjectDetail.value = null;
  menuIds.value = [];

  try {
    if (isRole.value && selectedRoleId.value !== null) {
      const result = await permApi.roleDetail(selectedRoleId.value);
      if (requestId !== detailRequestId) {
        return false;
      }
      roleDetail.value = result;
      menuIds.value = [...result.menuIds];
      dataScope.value = result.dataScope;
      scopeOrgIds.value = [...result.scopeOrgIds];
    } else if (subjectType.value === 'post' && selectedPostId.value !== null) {
      const result = await permApi.postDetail(selectedPostId.value);
      if (requestId !== detailRequestId) {
        return false;
      }
      subjectDetail.value = result;
      menuIds.value = [...result.menuIds];
    } else if (subjectType.value === 'org' && selectedOrgId.value !== null) {
      const result = await permApi.orgDetail(selectedOrgId.value);
      if (requestId !== detailRequestId) {
        return false;
      }
      subjectDetail.value = result;
      menuIds.value = [...result.menuIds];
    }
    return true;
  } catch (error) {
    if (requestId !== detailRequestId) {
      return false;
    }
    detailError.value = error instanceof Error ? error.message : '权限详情加载失败';
    return false;
  } finally {
    if (requestId === detailRequestId) {
      detailLoading.value = false;
    }
  }
}

/* ==================== 选择授权对象 ==================== */
function selectOrg(orgId: number): void {
  if (isBusy.value) {
    return;
  }
  if (
    activeTab.value === 'postorg' &&
    subjectType.value === 'org' &&
    selectedOrgId.value === orgId
  ) {
    if (!subjectDetail.value) {
      void loadPermissionDetail();
    }
    return;
  }
  runAfterDiscard(() => {
    activeTab.value = 'postorg';
    roleRightTab.value = 'menu';
    subjectType.value = 'org';
    selectedOrgId.value = orgId;
    selectedPostId.value = null;
    void loadPermissionDetail();
  });
}

function selectPost(post: PostTreeNode): void {
  if (isBusy.value) {
    return;
  }
  if (
    activeTab.value === 'postorg' &&
    subjectType.value === 'post' &&
    selectedPostId.value === post.postId
  ) {
    if (!subjectDetail.value) {
      void loadPermissionDetail();
    }
    return;
  }
  runAfterDiscard(() => {
    activeTab.value = 'postorg';
    roleRightTab.value = 'menu';
    subjectType.value = 'post';
    selectedPostId.value = post.postId;
    selectedOrgId.value = post.orgId;
    void loadPermissionDetail();
  });
}

function selectRole(roleId: number): void {
  if (isBusy.value) {
    return;
  }
  if (isRole.value && selectedRoleId.value === roleId) {
    roleRightTab.value = 'menu';
    if (!roleDetail.value) {
      void loadPermissionDetail();
    }
    return;
  }
  runAfterDiscard(() => {
    activeTab.value = 'role';
    selectedRoleId.value = roleId;
    roleRightTab.value = 'menu';
    void loadPermissionDetail();
  });
}

function switchTab(tab: Tab): void {
  if (isBusy.value || activeTab.value === tab) {
    return;
  }
  if (tab === 'role' && !canLoadRoles.value) {
    return;
  }
  if (tab === 'postorg' && !canLoadOrgs.value) {
    return;
  }
  runAfterDiscard(() => {
    activeTab.value = tab;
    roleRightTab.value = 'menu';

    if (tab === 'role') {
      if (selectedRoleId.value === null) {
        selectedRoleId.value = roles.value[0]?.roleId ?? null;
      }
      void loadPermissionDetail();
      return;
    }

    if (subjectType.value === 'post' && selectedPostId.value !== null && canLoadPosts.value) {
      void loadPermissionDetail();
      return;
    }

    if (selectedOrgId.value === null) {
      selectedOrgId.value = orgRows.value[0]?.org.orgId ?? null;
    }
    void loadPermissionDetail();
  });
}

function switchRoleRightTab(tab: RoleRightTab): void {
  if (isBusy.value || roleRightTab.value === tab) {
    return;
  }
  roleRightTab.value = tab;
}

function resetMenus(): void {
  if (isBusy.value) {
    return;
  }
  const saved = isRole.value ? roleDetail.value?.menuIds : subjectDetail.value?.menuIds;
  menuIds.value = [...(saved ?? [])];
}

function resetDataScope(): void {
  if (isBusy.value || !roleDetail.value) {
    return;
  }
  dataScope.value = roleDetail.value.dataScope;
  scopeOrgIds.value = [...roleDetail.value.scopeOrgIds];
}

function sameIdSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const set = new Set(left);
  return right.every((id) => set.has(id));
}

/** 当前草稿与最近一次加载 / 保存结果是否不一致。 */
const draftDirty = computed(() => {
  if (!hasDetail.value || detailLoading.value) {
    return false;
  }
  if (isRole.value && roleDetail.value) {
    return (
      !sameIdSet(menuIds.value, roleDetail.value.menuIds) ||
      dataScope.value !== roleDetail.value.dataScope ||
      // 只有自定义范围才比较组织清单，切换档位时的残留勾选不算修改
      (dataScope.value === '2' && !sameIdSet(scopeOrgIds.value, roleDetail.value.scopeOrgIds))
    );
  }
  if (subjectDetail.value) {
    return !sameIdSet(menuIds.value, subjectDetail.value.menuIds);
  }
  return false;
});

const discardOpen = ref(false);
let pendingAction: (() => void) | null = null;
let pendingLeave: ((allow: boolean) => void) | null = null;

/** 切换授权对象前，如存在未保存草稿则先确认。 */
function runAfterDiscard(action: () => void): void {
  if (!draftDirty.value) {
    action();
    return;
  }
  pendingAction = action;
  discardOpen.value = true;
}

function confirmDiscard(): void {
  const action = pendingAction;
  const resolveLeave = pendingLeave;
  pendingAction = null;
  pendingLeave = null;
  discardOpen.value = false;
  if (resolveLeave) {
    resolveLeave(true);
    return;
  }
  action?.();
}

watch(discardOpen, (value) => {
  if (value) {
    return;
  }
  pendingAction = null;
  const resolveLeave = pendingLeave;
  pendingLeave = null;
  resolveLeave?.(false);
});

// 离开页面时同样保护未保存草稿，避免切换菜单或刷新丢失修改。
onBeforeRouteLeave(() => {
  if (!draftDirty.value) {
    return true;
  }
  if (pendingLeave) {
    pendingLeave(false);
    pendingLeave = null;
  }
  return new Promise<boolean>((resolve) => {
    pendingLeave = resolve;
    discardOpen.value = true;
  });
});

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!draftDirty.value) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
}

/* ==================== 保存 ==================== */
async function saveMenus(): Promise<void> {
  if (!hasDetail.value || currentLocked.value || !canSaveMenus.value || isBusy.value) {
    return;
  }
  savingMenus.value = true;
  try {
    if (isRole.value && roleDetail.value) {
      const roleId = roleDetail.value.roleId;
      const updated = await permApi.saveRoleMenus(roleId, menuIds.value);
      if (roleDetail.value?.roleId === roleId) {
        roleDetail.value = updated;
        menuIds.value = [...updated.menuIds];
      }
      toast.success('角色菜单权限已保存');
    } else if (!isRole.value && subjectDetail.value) {
      const subject = subjectDetail.value;
      const updated =
        subject.type === 'post'
          ? await permApi.savePostMenus(subject.id, menuIds.value)
          : await permApi.saveOrgMenus(subject.id, menuIds.value);
      if (subjectDetail.value?.id === subject.id && subjectDetail.value.type === subject.type) {
        subjectDetail.value = updated;
        menuIds.value = [...updated.menuIds];
      }
      toast.success(`${subject.type === 'post' ? '岗位' : '组织'}菜单权限已保存`);
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '菜单权限保存失败');
  } finally {
    savingMenus.value = false;
  }
}

async function saveDataScope(): Promise<void> {
  if (!roleDetail.value || currentLocked.value || !canSaveScope.value || isBusy.value) {
    return;
  }
  savingScope.value = true;
  try {
    const roleId = roleDetail.value.roleId;
    const result = await permApi.saveRoleDataScope(roleId, {
      dataScope: dataScope.value,
      orgIds: dataScope.value === '2' ? scopeOrgIds.value : undefined,
    });
    if (roleDetail.value?.roleId === roleId) {
      roleDetail.value = {
        ...roleDetail.value,
        dataScope: result.dataScope,
        scopeOrgIds: [...result.scopeOrgIds],
      };
      dataScope.value = result.dataScope;
      scopeOrgIds.value = [...result.scopeOrgIds];
    }
    toast.success('角色数据范围已保存');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '数据范围保存失败');
  } finally {
    savingScope.value = false;
  }
}

/* ==================== 刷新与路由联动 ==================== */
async function doRefreshAll(): Promise<void> {
  const baseOk = await loadBaseData();
  const detailOk = await loadPermissionDetail();
  if (baseOk && detailOk) {
    toast.success('权限数据已刷新');
  }
}

async function refreshAll(): Promise<void> {
  if (isBusy.value) {
    return;
  }
  if (draftDirty.value) {
    runAfterDiscard(() => void doRefreshAll());
    return;
  }
  await doRefreshAll();
}

function readRoleId(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

watch(
  () => route.query.roleId,
  (value) => {
    if (isBusy.value) {
      return;
    }
    const roleId = readRoleId(value);
    if (!roleId || !canLoadRoles.value || !roles.value.some((role) => role.roleId === roleId)) {
      return;
    }
    if (isRole.value && selectedRoleId.value === roleId) {
      return;
    }
    runAfterDiscard(() => {
      activeTab.value = 'role';
      selectedRoleId.value = roleId;
      roleRightTab.value = 'menu';
      void loadPermissionDetail();
    });
  },
);

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  await loadBaseData();

  const queryRoleId = readRoleId(route.query.roleId);
  if (queryRoleId && canLoadRoles.value && roles.value.some((role) => role.roleId === queryRoleId)) {
    activeTab.value = 'role';
    selectedRoleId.value = queryRoleId;
  } else if (canLoadOrgs.value) {
    activeTab.value = 'postorg';
    if (subjectType.value !== 'post') {
      subjectType.value = 'org';
    }
    if (selectedOrgId.value === null) {
      selectedOrgId.value = orgRows.value[0]?.org.orgId ?? null;
    }
  } else if (canLoadRoles.value) {
    activeTab.value = 'role';
    if (selectedRoleId.value === null) {
      selectedRoleId.value = roles.value[0]?.roleId ?? null;
    }
  }

  await loadPermissionDetail();
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (pendingLeave) {
    pendingLeave(false);
    pendingLeave = null;
  }
});
</script>

<template>
  <div class="mx-auto max-w-[1500px]">
    <PageHeader
      title="权限管理"
      description="左侧选择授权对象（组织 / 岗位 / 角色），右侧勾选菜单与动作权限；角色另可配置数据范围。"
    >
      <template #actions>
        <Button variant="outline" size="sm" :disabled="baseLoading || isBusy" @click="refreshAll">
          <RefreshCw class="size-4" :class="baseLoading && 'animate-spin'" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <div class="grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
      <!-- 左栏：授权对象 -->
      <aside
        class="flex max-h-[calc(100vh-10rem)] min-h-[24rem] flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div class="flex items-center gap-1 border-b p-1.5">
          <button
            type="button"
            class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              activeTab === 'postorg'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            "
            :disabled="!canLoadOrgs || isBusy"
            :aria-pressed="activeTab === 'postorg'"
            @click="switchTab('postorg')"
          >
            岗位 / 组织权限
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              activeTab === 'role'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            "
            :disabled="!canLoadRoles || isBusy"
            :aria-pressed="activeTab === 'role'"
            @click="switchTab('role')"
          >
            角色权限
            <span
              class="rounded-full px-1 text-[10px]"
              :class="activeTab === 'role' ? 'bg-white/20' : 'bg-muted-foreground/15'"
            >
              {{ roles.length }}
            </span>
          </button>
        </div>

        <div
          v-if="baseError && !baseLoading"
          class="flex items-start gap-2 border-b bg-destructive/5 px-3 py-2 text-[11px] leading-relaxed text-destructive"
          role="alert"
        >
          <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
          <span class="min-w-0 flex-1">{{ baseError }}</span>
          <button type="button" class="shrink-0 underline" @click="refreshAll">重试</button>
        </div>

        <div v-if="activeTab === 'role'" class="border-b p-2">
          <div class="relative">
            <Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="roleKeyword"
              aria-label="搜索角色名称或权限字符"
              placeholder="搜索角色名称 / 权限字符"
              class="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <div v-if="baseLoading" class="space-y-1.5 p-1">
            <div v-for="index in 8" :key="index" class="h-12 animate-pulse rounded-lg bg-muted" />
          </div>

          <template v-else-if="activeTab === 'role'">
            <button
              v-for="role in filteredRoles"
              :key="role.roleId"
              type="button"
              class="mb-1 flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors"
              :class="
                isRoleSelected(role.roleId)
                  ? 'border-primary bg-accent/60'
                  : 'border-transparent hover:border-border hover:bg-muted/40'
              "
              @click="selectRole(role.roleId)"
            >
              <span
                class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600"
              >
                <ShieldCheck class="size-3.5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ role.roleName }}</span>
                  <Badge v-if="role.roleId === 1" variant="warning" class="shrink-0">内置</Badge>
                  <Badge v-else-if="role.status === '1'" variant="muted" class="shrink-0">
                    停用
                  </Badge>
                </span>
                <span class="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {{ role.roleKey }}
                </span>
                <span class="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{{ DATA_SCOPE_LABELS[role.dataScope] }}</span>
                  <span>·</span>
                  <span>{{ role.userCount }} 人</span>
                  <span>·</span>
                  <span>{{ role.menuCount }} 项权限</span>
                </span>
              </span>
            </button>
            <EmptyState
              v-if="!filteredRoles.length"
              compact
              :text="canLoadRoles ? '没有匹配的角色' : '当前账号缺少角色查询权限'"
            >
              <Button v-if="roleKeyword" variant="ghost" size="sm" @click="roleKeyword = ''">
                清空搜索
              </Button>
            </EmptyState>
          </template>

          <template v-else>
            <div
              v-for="row in leftRows"
              :key="row.key"
              role="button"
              tabindex="0"
              class="mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-lg border py-1.5 pr-2 transition-colors"
              :class="
                cn(
                  (row.kind === 'org' && isOrgSelected(row.org.orgId)) ||
                    (row.kind === 'post' && isPostSelected(row.post?.postId ?? 0))
                    ? 'border-primary bg-accent/60'
                    : 'border-transparent hover:border-border hover:bg-muted/40',
                )
              "
              :style="{ paddingLeft: `${Math.min(row.level, 8) * 14 + 6}px` }"
              @click="
                row.kind === 'org'
                  ? selectOrg(row.org.orgId)
                  : row.post && selectPost(row.post)
              "
              @keydown.enter.prevent="
                row.kind === 'org'
                  ? selectOrg(row.org.orgId)
                  : row.post && selectPost(row.post)
              "
            >
              <button
                v-if="row.kind === 'org' && row.expandable"
                type="button"
                class="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background"
                :title="collapsedOrgs.has(row.org.orgId) ? '展开下级' : '收起下级'"
                :aria-label="collapsedOrgs.has(row.org.orgId) ? '展开下级' : '收起下级'"
                :aria-expanded="!collapsedOrgs.has(row.org.orgId)"
                @click.stop="toggleOrgCollapse(row.org.orgId)"
              >
                <ChevronRight v-if="collapsedOrgs.has(row.org.orgId)" class="size-3" />
                <ChevronDown v-else class="size-3" />
              </button>
              <span v-else class="size-4 shrink-0" />

              <Building2
                v-if="row.kind === 'org'"
                class="size-3.5 shrink-0 text-primary"
              />
              <Briefcase v-else class="size-3.5 shrink-0 text-amber-600" />

              <span class="min-w-0 flex-1 truncate text-xs" :class="row.kind === 'org' && 'font-medium'">
                {{ row.kind === 'org' ? row.org.orgName : row.post?.postName }}
              </span>

              <Star
                v-if="row.kind === 'post' && row.post?.isLeader"
                class="size-3 shrink-0 text-amber-500"
                title="责任岗位"
              />
              <span
                v-if="row.kind === 'post' && row.post?.status === '1'"
                class="shrink-0 text-[10px] text-muted-foreground"
              >
                停用
              </span>
              <span
                v-else-if="row.kind === 'org' && row.org.status === '1'"
                class="shrink-0 text-[10px] text-muted-foreground"
              >
                停用
              </span>
              <span
                v-else-if="row.kind === 'post' && row.post"
                class="shrink-0 text-[10px] text-muted-foreground"
              >
                {{ row.post.headcount }}
              </span>
            </div>
            <EmptyState
              v-if="!leftRows.length"
              compact
              :text="
                !canLoadOrgs
                  ? '当前账号缺少组织查询权限'
                  : baseError
                    ? '组织或岗位数据加载失败'
                    : '暂无组织或岗位'
              "
            />
          </template>
        </div>

        <div class="border-t bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          最终权限 = 角色 ∪ 岗位 ∪ 组织；组织权限沿组织树向下继承。
          <p v-if="postNotice" class="mt-1 text-amber-700">{{ postNotice }}</p>
        </div>
      </aside>

      <!-- 右栏：权限配置 -->
      <section class="min-w-0 space-y-3">
        <div class="rounded-xl border bg-card p-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="flex size-7 shrink-0 items-center justify-center rounded-md"
                  :class="
                    isRole
                      ? 'bg-violet-100 text-violet-600'
                      : subjectType === 'post'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                  "
                >
                  <ShieldCheck v-if="isRole" class="size-4" />
                  <Briefcase v-else-if="subjectType === 'post'" class="size-4" />
                  <Building2 v-else class="size-4" />
                </span>
                <h2 class="truncate text-base font-semibold">{{ subjectTitle }}</h2>
                <Badge :variant="subjectTagVariant">{{ subjectTag }}</Badge>
                <Badge v-if="currentLocked" variant="warning">
                  <Lock class="size-3" />
                  锁定
                </Badge>
                <Badge v-else-if="!canEditCurrent" variant="muted">只读</Badge>
                <Badge v-else variant="success">可编辑</Badge>
              </div>
              <p v-if="subjectSub" class="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {{ subjectSub }}
              </p>
              <p class="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {{ subjectNote }}
              </p>
            </div>

            <div
              v-if="isRole"
              class="flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5"
            >
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  roleRightTab === 'menu'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                :disabled="isBusy"
                :aria-pressed="roleRightTab === 'menu'"
                @click="switchRoleRightTab('menu')"
              >
                菜单权限
              </button>
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  roleRightTab === 'data'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                :disabled="isBusy"
                :aria-pressed="roleRightTab === 'data'"
                @click="switchRoleRightTab('data')"
              >
                数据权限
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="!hasSelection"
          class="flex min-h-72 items-center justify-center rounded-xl border bg-card shadow-sm"
        >
          <EmptyState :text="emptySelectionText" />
        </div>

        <div
          v-else-if="detailLoading"
          class="rounded-xl border bg-card p-4 shadow-sm"
        >
          <div class="mb-3 h-9 w-56 animate-pulse rounded-md bg-muted" />
          <div class="space-y-2">
            <div v-for="index in 8" :key="index" class="h-9 animate-pulse rounded-md bg-muted" />
          </div>
        </div>

        <div
          v-else-if="detailError"
          class="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm"
        >
          <span class="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle class="size-5" />
          </span>
          <div>
            <p class="text-sm font-medium">权限详情加载失败</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ detailError }}</p>
          </div>
          <Button variant="outline" size="sm" @click="loadPermissionDetail">
            <RefreshCw class="size-3.5" />
            重试
          </Button>
        </div>

        <template v-else-if="hasDetail">
          <DataScopePanel
            v-if="isDataTab"
            v-model:data-scope="dataScope"
            v-model:org-ids="scopeOrgIds"
            :orgs="orgTree"
            :loading="savingScope"
            :locked="currentLocked"
            :readonly="!canSaveScope"
            :dirty="draftDirty"
            @save="saveDataScope"
            @reset="resetDataScope"
          />

          <template v-else>
            <PermissionTree
              v-model="menuIds"
              :menus="menuTree"
              :loading="detailLoading"
              :locked="currentLocked"
              :readonly="!canSaveMenus"
              :busy="savingMenus"
              :empty-text="menuTree.length ? '没有匹配的菜单' : menuEmptyText"
            />

            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-sm"
            >
              <span class="text-xs text-muted-foreground">
                已选 <span class="font-mono font-medium text-foreground">{{ menuIds.length }}</span>
                项；
                <span class="font-mono">{{ isRole ? 'sys_role_menu' : subjectType === 'post' ? 'sys_post_menu' : 'sys_org_menu' }}</span>
                <span v-if="draftDirty" class="ml-2 text-amber-700">有未保存修改</span>
              </span>

              <span v-if="currentLocked" class="flex items-center gap-1.5 text-xs text-amber-700">
                <Lock class="size-3.5" />
                超级管理员权限锁定，无需配置
              </span>
              <span v-else-if="!canSaveMenus" class="text-xs text-muted-foreground">
                当前账号无权限保存（需要 {{ PERMS.PERM_SAVE }}）
              </span>
              <div v-else class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="savingMenus"
                  @click="resetMenus"
                >
                  <RotateCcw class="size-3.5" />
                  还原
                </Button>
                <Button size="sm" :disabled="savingMenus" @click="saveMenus">
                  <Loader2 v-if="savingMenus" class="size-3.5 animate-spin" />
                  <Save v-else class="size-3.5" />
                  保存菜单权限
                </Button>
              </div>
            </div>
          </template>
        </template>
      </section>
    </div>

    <ConfirmDialog
      v-model:open="discardOpen"
      title="放弃未保存的修改"
      description="当前授权对象还有未保存的菜单权限或数据范围修改，继续操作将丢失这些改动。"
      confirm-text="放弃修改"
      cancel-text="返回编辑"
      @confirm="confirmDiscard"
    />
  </div>
</template>
