// CORS 白名单回归测试：非法 Origin 应 403（而非 500），白名单 Origin 应放行
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, api } = require('./helpers');

// 必须在 createTestApp 之前设置：CORS_ORIGIN 开启跨域白名单
process.env.CORS_ORIGIN = 'https://allowed.example.com';

let ctx;
before(async () => { ctx = await createTestApp(); });
after(async () => { await ctx.close(); });

describe('CORS 白名单', () => {
  test('无 Origin（同源）请求正常', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/health');
    assert.equal(res.status, 200);
  });

  test('白名单 Origin 放行', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`, {
      headers: { 'Origin': 'https://allowed.example.com' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://allowed.example.com');
  });

  test('非法 Origin 返回 403（而非 500）', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`, {
      headers: { 'Origin': 'https://evil.example.com' },
    });
    assert.equal(res.status, 403, `非法 Origin 应 403，实际 ${res.status}`);
  });
});
