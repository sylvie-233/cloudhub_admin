/** 测试环境先于被测模块加载，确保 env.ts 校验通过。 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cloudhub-admin-test-secret-123456';
process.env.JWT_EXPIRES_IN = '7200';
