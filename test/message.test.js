// message/gotify 模块集成测试：应用、消息、Gotify 兼容端点
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, api } = require('./helpers');

let ctx;
let adminToken;
let appToken;
let appId;

before(async () => {
  ctx = await createTestApp();
  const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'admin', pass: 'admin' } });
  adminToken = login.data.token;
});
after(async () => { await ctx.close(); });

describe('应用管理', () => {
  test('创建应用返回完整 token（仅此一次）', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/api/application', {
      token: adminToken,
      body: { name: '测试应用', description: 'desc' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.token.length > 20, '创建时返回完整 token');
    appToken = res.data.token;
    appId = res.data.id;
  });

  test('列表返回掩码 token（不泄露完整 token）', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/application', { token: adminToken });
    assert.equal(res.status, 200);
    const app = res.data.find(a => a.id === appId);
    assert.ok(app);
    assert.ok(app.token.includes('...'), '列表 token 被掩码');
    assert.ok(!app.token.includes(appToken), '不包含完整 token');
  });

  test('未登录无法访问应用列表', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/application');
    assert.equal(res.status, 401);
  });
});

describe('消息发送（Gotify 兼容端点 POST /message）', () => {
  test('用 app token 发消息成功', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/message', {
      appToken,
      body: { title: '测试标题', message: 'hello miotify', priority: 5 },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.message, 'hello miotify');
    assert.equal(res.data.priority, 5);
    assert.ok(res.data.id);
  });

  test('无 token 返回 401', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/message', { body: { message: 'x' } });
    assert.equal(res.status, 401);
  });

  test('缺少 message 返回 400', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/message', { appToken, body: { title: 'no msg' } });
    assert.equal(res.status, 400);
  });

  test('消息超长返回 400', async () => {
    const res = await api(ctx.baseUrl, 'POST', '/message', {
      appToken,
      body: { message: 'x'.repeat(5001) },
    });
    assert.equal(res.status, 400);
  });
});

describe('消息列表（用户 API + Gotify 兼容）', () => {
  test('用户 API 能看到自己的消息', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/message', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.messages.length >= 1);
    const msg = res.data.messages.find(m => m.title === '测试标题');
    assert.ok(msg, '能查到刚发的消息');
    assert.equal(msg.priority, 5);
  });

  test('Gotify 兼容端点 GET /message 返回消息', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/message', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.messages.length >= 1);
  });

  test('删除消息后列表为空', async () => {
    const list = await api(ctx.baseUrl, 'GET', '/api/message', { token: adminToken });
    const msg = list.data.messages[0];
    const del = await api(ctx.baseUrl, 'DELETE', `/api/message/${msg.id}`, { token: adminToken });
    assert.equal(del.status, 200);
    const again = await api(ctx.baseUrl, 'GET', '/api/message', { token: adminToken });
    assert.ok(!again.data.messages.some(m => m.id === msg.id), '删除后不存在');
  });
});

describe('越权防护', () => {
  test('普通用户看不到别人的应用消息（appid 越权 404）', async () => {
    // 创建普通用户
    const createUser = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'mallory', pass: 'mallory-pass', admin: false },
    });
    assert.equal(createUser.status, 201);
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'mallory', pass: 'mallory-pass' } });
    const userToken = login.data.token;

    // mallory 尝试读取 admin 的 app（appId）
    const res = await api(ctx.baseUrl, 'GET', `/api/message?appid=${appId}`, { token: userToken });
    assert.equal(res.status, 404, '越权访问他人应用的消息应 404');
  });

  test('普通用户不能删除他人的消息', async () => {
    // 先发一条消息
    await api(ctx.baseUrl, 'POST', '/message', { appToken, body: { message: 'to-delete' } });
    const list = await api(ctx.baseUrl, 'GET', '/api/message', { token: adminToken });
    const msg = list.data.messages[0];

    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'mallory', pass: 'mallory-pass' } });
    const res = await api(ctx.baseUrl, 'DELETE', `/api/message/${msg.id}`, { token: login.data.token });
    assert.equal(res.status, 404, '越权删除他人消息应 404');
  });
});
