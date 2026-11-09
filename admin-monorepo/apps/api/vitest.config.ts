import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    // 接口测试会经过请求日志中间件，静默控制台避免污染测试输出
    silent: true,
  },
});
