import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

import base from './base.js';

/**
 * Vue 3 + TypeScript 平面配置（浏览器环境）。
 * @type {import('eslint').Linter.Config[]}
 */
export default tseslint.config(
  ...base,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
    },
  },
  // base 中的 Prettier 配置在前，这里需再次放到末尾，覆盖 Vue 插件的格式规则
  eslintConfigPrettier,
);
