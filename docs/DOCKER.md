# Docker 构建与发布指南

本文档说明如何使用 Docker 构建和发布 Miotify 镜像。

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t miotify:latest .

# 运行容器
docker run -d \
  --name miotify \
  -p 8080:8080 \
  -v miotify-data:/app/data \
  -e JWT_SECRET=your-secret-key \
  miotify:latest

# 查看日志
docker logs -f miotify
```

## 镜像说明

### 多阶段构建

Dockerfile 采用多阶段构建优化镜像大小：

| 阶段 | 用途 |
|------|------|
| `builder` | 安装依赖、构建前端 |
| `runtime` | 生产运行环境 |

### 安全特性

- 基于 Alpine Linux，最小化攻击面
- 使用非 root 用户 (`miotify:miotify`) 运行
- 使用 `tini` 作为 init 进程
- 内置健康检查

### 镜像大小

| 组件 | 大小 |
|------|------|
| 基础镜像 | ~50MB |
| Node.js 依赖 | ~80MB |
| 前端资源 | ~300KB |
| **总计** | **~130MB** |

## CI/CD 流程

### 工作流触发条件

| 事件 | 触发的工作流 |
|------|-------------|
| Push 到 main/master | CI（测试+构建） |
| Push tag `v*` | Release + Docker Publish |
| Pull Request | CI（测试+构建，不推送镜像） |
| 手动触发 | Release 或 Docker Publish |

### 版本管理

使用语义化版本控制 (SemVer)：

```
v1.0.0 -> v1.0.1 (patch: bug fixes)
v1.0.0 -> v1.1.0 (minor: new features)
v1.0.0 -> v2.0.0 (major: breaking changes)
```

#### 发布新版本

```bash
# 方式1: 使用脚本
./scripts/version.sh patch  # 或 minor, major
./scripts/version.sh release

# 方式2: 手动
npm version patch
git push origin main --follow-tags

# 方式3: GitHub Actions
# 在 Actions 页面手动触发 Release workflow
```

### 镜像标签策略

| 触发条件 | 镜像标签 |
|----------|----------|
| Push 到 main | `latest`, `sha-<commit>` |
| Tag v1.2.3 | `v1.2.3`, `1.2`, `1`, `latest` |
| PR #123 | `pr-123` |

## 安全扫描

### Trivy 扫描

每次构建都会自动运行 Trivy 安全扫描：

- 扫描级别：CRITICAL, HIGH
- 忽略未修复的漏洞
- 结果上传到 GitHub Security

### 本地扫描

```bash
# 安装 Trivy
brew install trivy  # macOS
# 或
sudo apt-get install trivy  # Linux

# 扫描镜像
trivy image miotify:latest

# 只显示高危漏洞
trivy image --severity HIGH,CRITICAL miotify:latest
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8080 | 服务端口 |
| `JWT_SECRET` | - | JWT 密钥（必须修改） |
| `JWT_EXPIRES_IN` | 7d | Token 有效期 |
| `DB_PATH` | /app/data/miotify.db | 数据库路径 |
| `DEFAULT_ADMIN_USER` | admin | 默认管理员用户名 |
| `DEFAULT_ADMIN_PASS` | admin | 默认管理员密码 |

### 数据持久化

```yaml
volumes:
  - miotify-data:/app/data           # 数据库
  - ./plugins/available:/app/plugins # 自定义插件
```

## GitHub Secrets 配置

在仓库 Settings > Secrets and variables > Actions 中配置：

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook（可选） |

## 本地开发

```bash
# 开发模式（热重载）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# 查看构建日志
docker build --progress=plain -t miotify:latest .

# 多平台构建
docker buildx build --platform linux/amd64,linux/arm64 -t miotify:latest .
```

## 故障排查

### 容器无法启动

```bash
# 查看日志
docker logs miotify

# 检查健康状态
docker inspect miotify | jq '.[0].State.Health'
```

### 权限问题

```bash
# 修复数据目录权限
docker exec -u root miotify chown -R miotify:miotify /app/data
```

### 数据库问题

```bash
# 备份数据库
docker cp miotify:/app/data/miotify.db ./backup/

# 恢复数据库
docker cp ./backup/miotify.db miotify:/app/data/
```
