# Miotify API 接入示例

本目录包含多种编程语言的 Miotify API 接入示例代码。

## 目录结构

```
examples/
├── javascript/
│   ├── send-message.js      # Node.js 发送消息示例
│   └── websocket-client.js  # Node.js WebSocket 接收消息示例
├── python/
│   ├── send-message.py      # Python 发送消息示例
│   └── websocket-client.py  # Python WebSocket 接收消息示例
├── curl/
│   ├── api-examples.sh      # Bash/curl 命令示例
│   └── api-examples.ps1     # PowerShell 命令示例
└── README.md
```

## 快速开始

### 1. 启动服务器

```bash
cd /path/to/miotify
npm run prod
```

服务器将在 `http://localhost:8080` 启动。

### 2. 默认管理员账号

- 用户名: `admin`
- 密码: `admin`

## API 概览

### 认证流程

```
1. 登录获取 JWT Token
2. 使用 JWT Token 调用管理 API
3. 使用 App Token 发送消息
```

### 主要端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/login` | POST | 无 | 用户登录 |
| `/api/application` | POST | JWT | 创建应用 |
| `/api/application` | GET | JWT | 列出应用 |
| `/api/message` | POST | App Token | 发送消息 |
| `/api/message` | GET | JWT | 获取消息列表 |
| `/ws` | WS | JWT (query) | WebSocket 实时消息 |

## JavaScript 示例

### 发送消息

```bash
cd examples/javascript
node send-message.js
```

### WebSocket 接收消息

```bash
cd examples/javascript
node websocket-client.js
```

## Python 示例

### 安装依赖

```bash
pip install requests websockets
```

### 发送消息

```bash
cd examples/python
python send-message.py
```

### WebSocket 接收消息

```bash
cd examples/python
python websocket-client.py
```

## curl 示例

### Bash (Linux/macOS)

```bash
cd examples/curl
chmod +x api-examples.sh
./api-examples.sh
```

### PowerShell (Windows)

```powershell
cd examples\curl
.\api-examples.ps1
```

## API 使用详解

### 1. 登录获取 Token

```bash
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","pass":"admin"}'
```

响应:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "id": 1,
  "name": "admin",
  "admin": true
}
```

### 2. 创建应用

```bash
curl -X POST http://localhost:8080/api/application \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name":"MyApp","description":"My application"}'
```

响应:
```json
{
  "id": 1,
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "name": "MyApp",
  "description": "My application",
  "user_id": 1,
  "created_at": "2026-01-01 12:00:00"
}
```

### 3. 发送消息

使用应用的 `token` 字段（不是 JWT Token）:

```bash
curl -X POST http://localhost:8080/api/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <APP_TOKEN>" \
  -d '{"title":"Alert","message":"Something happened!","priority":5}'
```

响应:
```json
{
  "id": 1,
  "appid": 1,
  "title": "Alert",
  "message": "Something happened!",
  "priority": 5,
  "created_at": "2026-01-01 12:00:00"
}
```

### 4. WebSocket 实时接收

```javascript
const ws = new WebSocket('ws://localhost:8080/ws?token=<YOUR_JWT_TOKEN>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message') {
    console.log('New message:', data.data);
  }
};
```

## 消息优先级

| 值 | 含义 |
|----|------|
| 0-1 | 低优先级（默认） |
| 2-4 | 中优先级 |
| 5+ | 高优先级 |

## 错误处理

所有错误响应格式:
```json
{
  "error": "Error message description"
}
```

常见错误码:
- `400` - 请求参数错误
- `401` - 未认证或 Token 无效
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求过于频繁
