import type { LoginInput, UserProfile } from '@cloudhub/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { authApi } from '@/api';
import { getToken, setToken } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken());
  const profile = ref<UserProfile | null>(null);
  const loading = ref(false);
  /** 资料加载遇到非鉴权类错误（如网络中断）时为 true，避免登录页反复跳回工作台。 */
  const profileError = ref(false);

  const isAuthenticated = computed(() => token.value.length > 0);
  const currentPost = computed(() => profile.value?.currentPost ?? null);
  const permissions = computed(() => new Set(profile.value?.permissions ?? []));
  const displayName = computed(
    () => profile.value?.nickName || profile.value?.userName || '未登录',
  );

  /** 是否拥有指定功能权限；传入数组时满足任意一个即可。 */
  function hasPerm(perm?: string | string[]): boolean {
    if (!perm) {
      return true;
    }
    const required = Array.isArray(perm) ? perm : [perm];
    return required.some((item) => permissions.value.has(item));
  }

  async function login(input: LoginInput): Promise<UserProfile> {
    loading.value = true;
    try {
      const result = await authApi.login(input);
      token.value = result.token;
      setToken(result.token);
      profile.value = result.profile;
      profileError.value = false;
      return result.profile;
    } finally {
      loading.value = false;
    }
  }

  /** 获取当前用户资料；force 为 true 时强制刷新。 */
  async function fetchProfile(force = false): Promise<UserProfile | null> {
    if (!token.value) {
      return null;
    }
    if (profile.value && !force) {
      return profile.value;
    }
    const data = await authApi.me();
    profile.value = data;
    profileError.value = false;
    return data;
  }

  function clearSession(): void {
    token.value = '';
    setToken('');
    profile.value = null;
    profileError.value = false;
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) {
        await authApi.logout();
      }
    } finally {
      clearSession();
    }
  }

  return {
    token,
    profile,
    loading,
    profileError,
    isAuthenticated,
    currentPost,
    permissions,
    displayName,
    hasPerm,
    login,
    fetchProfile,
    clearSession,
    logout,
  };
});
