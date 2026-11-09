import { toast } from '@cloudhub/ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { setUnauthorizedHandler } from './api/client';
import { useAuthStore } from './stores/auth';
import './styles/index.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// 令牌失效时统一清理会话并回到登录页
setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    return;
  }
  auth.clearSession();
  toast.error('登录状态已失效，请重新登录');
  void router.replace({
    name: 'login',
    query: { redirect: router.currentRoute.value.fullPath },
  });
});

app.mount('#app');
