// 回归测试：本次修复的安全/兼容性问题
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

  const app = await api(ctx.baseUrl, 'POST', '/api/application', {
    token: adminToken,
    body: { name: '回归测试应用' },
  });
  assert.equal(app.status, 201);
  appToken = app.data.token;
  appId = app.data.id;
});
after(async () => { await ctx.close(); });

describe('回归：limit 负数钳制', () => {
  before(async () => {
    // 造 3 条消息
    for (let i = 0; i < 3; i++) {
      await api(ctx.baseUrl, 'POST', '/message', {
        appToken,
        body: { title: `t${i}`, message: `m${i}` },
      });
    }
  });

  test('GET /api/message?limit=-1 被钳制为 1（不返回全量）', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/message?limit=-1', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.messages.length <= 1, `limit=-1 应被钳制，实际返回 ${res.data.messages.length} 条`);
  });

  test('GET /api/logs?limit=-5 被钳制为 1（不返回全量）', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/logs?limit=-5', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.logs.length <= 1, `logs limit=-5 应被钳制，实际返回 ${res.data.logs.length} 条`);
  });

  test('limit 正常值仍生效', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/message?limit=2', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.messages.length, 2);
  });
});

describe('回归：图片上传', () => {
  test('正常 PNG 上传成功', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.alloc(100, 0),
    ]);
    const res = await fetch(`${ctx.baseUrl}/api/application/${appId}/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', 'Authorization': `Bearer ${adminToken}` },
      body: png,
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.image.startsWith('/uploads/'), '上传成功后 image 字段为 /uploads/ 路径');
  });

  test('超过 2MB 的 body 被拒绝（400，流式拦截）', async () => {
    const big = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47]),
      Buffer.alloc(3 * 1024 * 1024, 0),
    ]);
    const res = await fetch(`${ctx.baseUrl}/api/application/${appId}/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', 'Authorization': `Bearer ${adminToken}` },
      body: big,
    });
    assert.equal(res.status, 400);
  });

  test('内容与声明类型不匹配被拒绝', async () => {
    const fake = Buffer.from('this is definitely not a png file at all');
    const res = await fetch(`${ctx.baseUrl}/api/application/${appId}/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', 'Authorization': `Bearer ${adminToken}` },
      body: fake,
    });
    assert.equal(res.status, 400);
  });

  test('PUT 不允许写入任意 image 字符串', async () => {
    const res = await api(ctx.baseUrl, 'PUT', `/api/application/${appId}`, {
      token: adminToken,
      body: { image: 'javascript:alert(1)' },
    });
    assert.equal(res.status, 400, '非法 image 应被拒绝');

    const res2 = await api(ctx.baseUrl, 'PUT', `/api/application/${appId}`, {
      token: adminToken,
      body: { image: 'https://example.com/icon.png' },
    });
    assert.equal(res2.status, 200, 'http(s) 外部 URL 应允许');
  });
});

describe('回归：token 版本失效（改密码后旧 token 无效）', () => {
  let userToken;
  let userId;
  before(async () => {
    const create = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'veruser', pass: 'old-pass', admin: false },
    });
    userId = create.data.id;
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'veruser', pass: 'old-pass' } });
    userToken = login.data.token;
  });

  test('改密码前旧 token 可用', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/application', { token: userToken });
    assert.equal(res.status, 200);
  });

  test('改密码后旧 token 立即失效（401）', async () => {
    const res = await api(ctx.baseUrl, 'PUT', `/api/user/${userId}/password`, {
      token: adminToken,
      body: { pass: 'new-pass' },
    });
    assert.equal(res.status, 200);
    const old = await api(ctx.baseUrl, 'GET', '/api/application', { token: userToken });
    assert.equal(old.status, 401, '改密后旧 token 应 401');
  });

  test('新密码可登录', async () => {
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'veruser', pass: 'new-pass' } });
    assert.equal(login.status, 200);
  });
});

describe('回归：Gotify paging 格式', () => {
  test('paging.next 是 URL 字符串而非数字 id', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/message?limit=2', { token: adminToken });
    assert.equal(res.status, 200);
    const paging = res.data.paging;
    assert.ok(paging, 'paging 存在');
    if (paging.next !== null) {
      assert.equal(typeof paging.next, 'string', 'next 应为 URL 字符串');
      assert.ok(paging.next.includes('/message?'), `next 应为消息 URL，实际 ${paging.next}`);
    }
  });
});

describe('回归：完整 token 端点', () => {
  test('GET /api/application/:id/token 返回完整 token', async () => {
    const res = await api(ctx.baseUrl, 'GET', `/api/application/${appId}/token`, { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.token, appToken, '应返回未掩码的完整 token');
  });

  test('他人应用返回 404（不泄露存在性）', async () => {
    const create = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'tokenuser', pass: 'token-pass', admin: false },
    });
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'tokenuser', pass: 'token-pass' } });
    const res = await api(ctx.baseUrl, 'GET', `/api/application/${appId}/token`, { token: login.data.token });
    assert.equal(res.status, 404, '普通用户访问他人应用完整 token 应 404');
  });
});

describe('回归：stats 时区统计', () => {
  test('发消息后今日/近7天/24小时分布统计正确', async () => {
    await api(ctx.baseUrl, 'POST', '/message', {
      appToken,
      body: { title: 'stats', message: 'stats-test' },
    });
    const res = await api(ctx.baseUrl, 'GET', '/api/stats', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.data.todayMessages >= 1, '今日消息 >= 1');
    assert.ok(res.data.totalMessages >= 1);

    // 近 7 天必须包含今天的日期且有计数（验证 SELECT 子句里日期修饰符的参数顺序）
    const tzOffsetMin = new Date().getTimezoneOffset();
    const now = new Date();
    now.setMinutes(now.getMinutes() - tzOffsetMin); // 转本地
    const todayLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = res.data.messagesByDay.find(d => d.date === todayLabel);
    assert.ok(today, `messagesByDay 应包含今天 ${todayLabel}，实际 ${JSON.stringify(res.data.messagesByDay)}`);
    assert.ok(today.count >= 1, '今天的计数 >= 1');

    // 24 小时分布应至少有 1 个小时有计数（验证 strftime 修饰符参数顺序）
    const hoursWithData = res.data.messagesByHour.filter(h => h.count > 0);
    assert.ok(hoursWithData.length >= 1, `24小时分布应有计数，实际 ${JSON.stringify(hoursWithData)}`);
  });
});

describe('回归：用户名 trim 与密码长度', () => {
  test('创建带空格用户名会被 trim，trim 后登录成功', async () => {
    const create = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: '  trimmed_user  ', pass: 'pw-123', admin: false },
    });
    assert.equal(create.status, 201);
    assert.equal(create.data.name, 'trimmed_user', '创建时用户名应被 trim');

    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'trimmed_user', pass: 'pw-123' } });
    assert.equal(login.status, 200, 'trim 后的用户名应能登录');
  });

  test('超过 72 字符的密码被拒绝（bcrypt 截断防护）', async () => {
    const create = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'longpw', pass: 'a'.repeat(100), admin: false },
    });
    assert.equal(create.status, 400, '超长密码创建应 400');
  });

  test('改自己的密码后旧 token 立即失效', async () => {
    const create = await api(ctx.baseUrl, 'POST', '/api/user', {
      token: adminToken,
      body: { name: 'selfpw', pass: 'old-pass', admin: false },
    });
    assert.equal(create.status, 201);
    const login = await api(ctx.baseUrl, 'POST', '/api/login', { body: { name: 'selfpw', pass: 'old-pass' } });
    const selfToken = login.data.token;

    const change = await api(ctx.baseUrl, 'PUT', `/api/user/${create.data.id}/password`, {
      token: selfToken, // 自己改自己的密码
      body: { pass: 'new-pass' },
    });
    assert.equal(change.status, 200);

    const after = await api(ctx.baseUrl, 'GET', '/api/application', { token: selfToken });
    assert.equal(after.status, 401, '改自己密码后旧 token 应 401（token_version 递增）');
  });
});

describe('回归：/api/message paging 格式', () => {
  test('paging.next 为 URL 字符串（与 gotify 端点一致）', async () => {
    const res = await api(ctx.baseUrl, 'GET', '/api/message?limit=1', { token: adminToken });
    assert.equal(res.status, 200);
    const paging = res.data.paging;
    assert.ok(paging, 'paging 存在');
    if (paging.next !== null) {
      assert.equal(typeof paging.next, 'string', 'next 应为 URL 字符串');
      assert.ok(paging.next.includes('/api/message?'), `next 应为 /api/message URL，实际 ${paging.next}`);
    }
  });
});
