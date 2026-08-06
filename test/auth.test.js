// auth 模块集成测试：登录、创建用户、权限控制
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, api } = require('./helpers');

let ctx;
before(async () => { ctx = await createTestApp(); });
after(async () => { await ctx.close(); });

describe('POST /api/login', () => {
  test('默认管理员 admin/admin 可登录', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin', pass: 'admin' } });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    assert.equal(res.data.name, 'admin');
    assert.equal(res.data.admin, true);
  });

  test('错误密码返回 401 且不泄露 token', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin', pass: 'wrong' } });
    assert.equal(res.status, 401);
    assert.equal(res.data.token, undefined);
  });

  test('不存在的用户返回统一 401（防用户名枚举）', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'ghost_user', pass: 'x' } });
    assert.equal(res.status, 401);
    // 错误信息与密码错误一致，不泄露用户是否存在
    assert.equal(res.data.error, '用户名或密码错误');
  });

  test('缺参返回 400', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin' } });
    assert.equal(res.status, 400);
  });
});

describe('用户管理', () => {
  let adminToken;
  let userId;
  before(async () => {
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin', pass: 'admin' } });
    adminToken = login.data.token;
  });

  test('管理员可创建用户', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'alice', pass: 'alice-pass', admin: false },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.name, 'alice');
    userId = res.data.id;
  });

  test('新用户可登录', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'alice', pass: 'alice-pass' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.admin, false);
  });

  test('普通用户无权创建用户（403）', async () => {
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'alice', pass: 'alice-pass' } });
    const res = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: login.data.token,
      body: { name: 'bob', pass: 'bob-pass', admin: false },
    });
    assert.equal(res.status, 403);
  });

  test('未登录访问用户列表 401', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/user');
    assert.equal(res.status, 401);
  });

  test('管理员可删除用户', async () => {
    const res = await api(ctx.baseUrl, 'DELETE', `/api/user/${userId}`, { token: adminToken });
    assert.equal(res.status, 200);
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'alice', pass: 'alice-pass' } });
    assert.equal(login.status, 401, '删除后无法再登录');
  });

  test('不能删除自己', async () => {
    const res = await api(ctx.baseUrl, 'DELETE', `/api/user/1`, { token: adminToken });
    assert.equal(res.status, 400);
  });
});
