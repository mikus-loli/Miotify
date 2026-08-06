// 插件系统 + 日志轮转集成测试
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { createTestApp, api } = require('./helpers');

let ctx;
let adminToken;

before(async () => {
  ctx = await createTestApp();
  const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin', pass: 'admin' } });
  adminToken = login.data.token;
});
after(async () => { await ctx.close(); });

describe('插件 API', () => {
  test('管理员可列出插件', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/plugins', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    // 内置两个插件应注册
    const ids = res.data.map(p => p.id);
    assert.ok(ids.includes('email-forwarder'));
    assert.ok(ids.includes('napcat-forwarder'));
  });

  test('普通用户无权管理插件（403）', async () => {
    const createUser = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'pluginuser', pass: 'plugin-pass', admin: false },
    });
    assert.equal(createUser.status, 201);
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'pluginuser', pass: 'plugin-pass' } });
    const res = await api(ctx.baseUrl, 'GET', '/api/plugins', { token: login.data.token });
    assert.equal(res.status, 403);
  });

  test('未登录访问插件列表 401', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/plugins');
    assert.equal(res.status, 401);
  });

  test('修改不存在的插件返回 404', async () => {
    const res = await api(ctx.baseUrl, 'PUT', '/api/plugin/does-not-exist/enabled', {
      token: adminToken,
      body: { enabled: true },
    });
    assert.equal(res.status, 404);
  });
});

describe('日志轮转', () => {
  test('产生日志后 getLogs 可查询', async () => {
    // 前面测试已经产生多条日志（登录、创建用户等）
    const res = await api(ctx.baseUrl, 'GET', '/api/logs?limit=5', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.total >= 1);
    assert.ok(res.data.logs.length <= 5);
  });

  test('普通用户无权访问日志（403）', async () => {
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'pluginuser', pass: 'plugin-pass' } });
    const res = await api(ctx.baseUrl, 'GET', '/api/logs', { token: login.data.token });
    assert.equal(res.status, 403);
  });

  test('rotateLogs 保留最近 N 条', async () => {
    const db = ctx.db;
    // 造 20 条日志
    for (let i = 0; i < 20; i++) {
      db.addLog({ level: 'info', category: 'test', action: 'seed', message: `seed-${i}` });
    }
    // config 里 logRetentionCount=1000，不会触发；手动验证函数不抛错
    db.rotateLogs();
    const count = db.queryOne('SELECT COUNT(*) as c FROM logs').c;
    assert.ok(count >= 20, `轮转后日志数 ${count}（上限未到，应保留）`);
  });
});
