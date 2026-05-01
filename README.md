# Miotify

一个轻量级的实时消息推送服务器，兼容 Gotify API，支持 WebSocket 实时通信、插件系统和多用户管理。

## 功能特性

- **实时消息推送** - 基于 WebSocket 的实时消息传输
- **Gotify API 兼容** - 完全兼容 Gotify REST API，支持青龙面板等第三方应用
- **多用户管理** - 支持多用户、多应用管理
- **插件系统** - 可扩展的插件架构，支持消息钩子
- **主题切换** - 支持亮色/暗色主题
- **Docker 部署** - 开箱即用的 Docker 支持
- **轻量级架构** - 基于 SQLite，无需额外数据库依赖

## 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [API 文档](#api-文档)
- [Gotify 兼容](#gotify-兼容)
- [插件系统](#插件系统)
- [Docker 部署](#docker-部署)
- [常见问题](#常见问题)
- [故障排除](#故障排除)

## 环境要求

- Node.js >= 18.0
- npm >= 9.0
- Docker (可选，用于容器化部署)

## 快速开始

### 方式一：本地运行

```bash
# 克隆项目
git clone https://github.com/your-repo/miotify.git
cd miotify

# 安装依赖
npm install

# 构建前端
npm run build

# 启动服务
npm start
```

服务将在 `http://localhost:8080` 启动。

### 方式二：Docker 部署

```bash
# 使用 docker-compose
docker-compose up -d

# 或直接运行
docker run -d \
  --name miotify \
  -p 8080:8080 \
  -v miotify-data:/app/data \
  ghcr.io/your-repo/miotify:latest
```

> 首次启动时，JWT 密钥会自动生成并显示在日志中。查看日志：`docker logs miotify`（首次启动时注意保存显示的 JWT Secret）

### 默认账号

首次启动会自动创建管理员账号：

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `admin` |

**⚠️ 请在生产环境中修改默认密码！**

## 配置说明

### 环境变量

创建 `.env` 文件或设置环境变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `8080` |
| `JWT_SECRET` | JWT 密钥（可选，首次运行自动生成） | 自动生成 |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `DB_PATH` | 数据库路径 | `./data/miotify.db` |
| `DEFAULT_ADMIN_USER` | 默认管理员用户名 | `admin` |
| `DEFAULT_ADMIN_PASS` | 默认管理员密码 | `admin` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `MAX_MESSAGE_LENGTH` | 消息最大长度 | `5000` |
| `MAX_MESSAGES_PER_APP` | 每应用最大消息数 | `200` |

> **首次启动说明**：如果未设置 `JWT_SECRET` 环境变量，系统会自动生成一个 128 字符的随机密钥并保存到数据库中，同时在控制台打印该密钥。请妥善保管此密钥，重启后会复用已保存的密钥。

### 开发模式

```bash
# 同时启动前后端开发服务
npm run dev

# 仅启动后端（支持热重载）
npm run dev:server

# 仅启动前端
npm run dev:web
```

## API 文档

### 认证方式

Miotify 使用两种 Token：

1. **JWT Token** - 用户登录后获取，用于管理 API
2. **App Token** - 应用创建时生成，用于发送消息

### 认证 API

#### 登录

```http
POST /api/login
Content-Type: application/json

{
  "name": "admin",
  "pass": "admin"
}
```

响应：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "id": 1,
  "name": "admin",
  "admin": true
}
```

### 应用管理 API

需要 JWT Token 认证（`Authorization: Bearer <JWT_TOKEN>`）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/application` | GET | 获取应用列表 |
| `/api/application` | POST | 创建应用 |
| `/api/application/:id` | GET | 获取应用详情 |
| `/api/application/:id` | PUT | 更新应用 |
| `/api/application/:id` | DELETE | 删除应用 |
| `/api/application/:id/image` | POST | 上传应用图标 |
| `/api/application/:id/image` | DELETE | 删除应用图标 |

#### 创建应用

```http
POST /api/application
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "My App",
  "description": "应用描述"
}
```

响应：
```json
{
  "id": 1,
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My App",
  "description": "应用描述",
  "image": null,
  "user_id": 1,
  "created_at": "2026-01-01 12:00:00"
}
```

### 消息 API

#### 发送消息

使用 App Token 认证：

```http
POST /api/message
Authorization: Bearer <APP_TOKEN>
Content-Type: application/json

{
  "title": "通知标题",
  "message": "消息内容",
  "priority": 5
}
```

#### 获取消息列表

使用 JWT Token 认证：

```http
GET /api/message?limit=50&appid=1
Authorization: Bearer <JWT_TOKEN>
```

#### 删除消息

```http
DELETE /api/message/:id
Authorization: Bearer <JWT_TOKEN>
```

### 用户管理 API

需要管理员权限

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user` | GET | 获取用户列表 |
| `/api/user` | POST | 创建用户 |
| `/api/user/:id` | PUT | 更新用户信息 |
| `/api/user/:id/password` | PUT | 修改密码 |
| `/api/user/:id` | DELETE | 删除用户 |

### WebSocket API

连接地址：`ws://host:port/ws?token=<JWT_TOKEN>`

```javascript
const ws = new WebSocket('ws://localhost:8080/ws?token=YOUR_JWT_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};
```

消息格式：
```json
{
  "type": "message",
  "data": {
    "id": 1,
    "appid": 1,
    "title": "通知标题",
    "message": "消息内容",
    "priority": 5,
    "created_at": "2026-01-01 12:00:00"
  }
}
```

## Gotify 兼容

Miotify 完全兼容 Gotify REST API，可直接用于青龙面板等支持 Gotify 的应用。

### 兼容端点

| Gotify 端点 | 说明 |
|-------------|------|
| `POST /message` | 发送消息 |
| `GET /message` | 获取消息列表 |
| `GET /message/:id` | 获取单条消息 |
| `DELETE /message/:id` | 删除消息 |
| `GET /application` | 获取应用列表 |
| `POST /application` | 创建应用 |
| `PUT /application/:id` | 更新应用 |
| `DELETE /application/:id` | 删除应用 |
| `GET /health` | 健康检查 |
| `GET /version` | 版本信息 |

### 认证方式

支持三种认证方式：

```bash
# 方式一：X-Gotify-Key 头
curl -H "X-Gotify-Key: <APP_TOKEN>" ...

# 方式二：token 查询参数
curl "http://host/message?token=<APP_TOKEN>" ...

# 方式三：Authorization Bearer
curl -H "Authorization: Bearer <APP_TOKEN>" ...
```

### 青龙面板配置

在青龙面板的通知设置中：

| 配置项 | 值 |
|--------|-----|
| `GOTIFY_URL` | `http://your-miotify-host:8080`（不带 `/message`） |
| `GOTIFY_TOKEN` | Miotify 应用的 token |
| `GOTIFY_PRIORITY` | 消息优先级（默认 0） |

## 插件系统

### 插件目录结构

```
plugins/
└── available/
    ├── email-forwarder.js    # 邮件转发插件
    ├── napcat-forwarder.js   # NapCat QQ转发插件
    └── message-logger.js     # 消息日志插件
```

### 插件开发

```javascript
module.exports = {
  meta: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: '插件描述',
    author: 'Author',
    license: 'MIT',
  },

  defaultConfig: {
    enabled: true,
    option1: 'default-value',
  },

  hooks: {
    'message:beforeSend': async (ctx, message) => {
      // 处理消息，返回 null 可阻止发送
      return message;
    },
    'message:afterSend': async (ctx, message) => {
      // 消息发送后的处理
    },
  },

  init: async (ctx) => {
    // 插件初始化
    const { config, log, db } = ctx;
    log('info', 'Plugin initialized');
  },

  destroy: () => {
    // 插件销毁
  },
};
```

### 可用钩子

| 钩子 | 参数 | 说明 |
|------|------|------|
| `message:beforeSend` | message | 消息发送前，返回 null 阻止发送 |
| `message:afterSend` | message | 消息发送后 |
| `user:onCreate` | user | 用户创建时 |
| `app:onCreate` | app | 应用创建时 |

### 内置插件

#### 邮件转发插件 (email-forwarder)

将消息转发到指定邮箱。

配置项：
- `smtp.host` - SMTP 服务器地址
- `smtp.port` - SMTP 端口
- `smtp.secure` - 是否使用 SSL
- `smtp.auth.user` - SMTP 用户名
- `smtp.auth.pass` - SMTP 密码
- `from` - 发件人地址
- `to` - 收件人地址

#### NapCat QQ转发插件 (napcat-forwarder)

将消息转发到 QQ（通过 NapCat）。

配置项：
- `httpUrl` - NapCat HTTP 地址
- `accessToken` - Access Token
- `targetType` - 目标类型（private/group）
- `targetId` - 目标 ID（QQ号/群号）
- `forwardAllApps` - 是否转发所有应用

## Docker 部署

### docker-compose.yml

```yaml
services:
  miotify:
    image: ghcr.io/your-repo/miotify:latest
    container_name: miotify
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TZ=Asia/Shanghai
      - DEFAULT_ADMIN_USER=admin
      - DEFAULT_ADMIN_PASS=admin
    volumes:
      - miotify-data:/app/data

volumes:
  miotify-data:
```

> **注意**：首次启动时，如果未设置 `JWT_SECRET` 环境变量，系统会自动生成一个随机密钥并保存到数据库中。后续重启将使用已保存的密钥。如需自定义密钥，可添加 `- JWT_SECRET=your-secret` 到环境变量。

### 常用命令

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose up --build -d

# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

## 常见问题

### Q: 忘记密码怎么办？

A: 删除数据库文件重新启动，会重新创建默认管理员账号。

### Q: 如何修改默认端口？

A: 设置环境变量 `PORT=你的端口` 或在 `.env` 文件中配置。

### Q: 消息发送失败返回 401？

A: 检查是否使用了正确的 Token 类型：
- 发送消息需要使用 **App Token**
- 管理 API 需要使用 **JWT Token**

### Q: 青龙面板通知失败？

A: 确保：
1. `GOTIFY_URL` 不带 `/message` 路径
2. `GOTIFY_TOKEN` 是应用的 token（UUID 格式）
3. Miotify 服务可被青龙面板访问

### Q: 如何备份数据？

A: 备份 `data/miotify.db` 文件即可。Docker 部署时备份对应的数据卷。

## 故障排除

### 查看日志

```bash
# Docker 部署
docker-compose logs -f miotify

# 本地运行
# 日志直接输出到控制台
```

### 常见错误

#### `EACCES: permission denied`

Docker 容器权限问题，确保数据目录权限正确：

```bash
docker-compose down
docker-compose up --build -d
```

#### `Token invalid or expired`

JWT Token 过期，重新登录获取新 Token。

#### `Application not found`

App Token 无效，检查是否使用了正确的应用 token。

### 健康检查

```bash
curl http://localhost:8080/health
```

正常响应：
```json
{"status":"ok","websocket":0}
```

## 开发

### 项目结构

```
miotify/
├── src/
│   ├── index.js          # 入口文件
│   ├── config.js         # 配置管理
│   ├── db/               # 数据库模块
│   ├── middleware/       # Express 中间件
│   ├── plugins/          # 插件管理器
│   ├── routes/           # API 路由
│   └── websocket/        # WebSocket 模块
├── web/                  # 前端项目
│   └── src/
│       ├── api/          # API 客户端
│       ├── components/   # React 组件
│       ├── pages/        # 页面组件
│       ├── store/        # Zustand 状态管理
│       └── styles/       # 样式文件
├── plugins/              # 插件目录
│   └── available/        # 可用插件
├── examples/             # 示例代码
└── Dockerfile
```

### 技术栈

**后端：**
- Node.js + Express
- SQLite (sql.js)
- WebSocket (ws)
- JWT 认证

**前端：**
- React + TypeScript
- Vite
- Zustand (状态管理)
- React Router

## License

MIT License
