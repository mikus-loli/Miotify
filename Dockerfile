FROM node:20-alpine AS builder

WORKDIR /app

# 强制使用官方 npm registry（node 镜像默认 npmmirror 偶发 503，拖垮构建）
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org

COPY package*.json ./
RUN npm ci --only=production

COPY web/package*.json ./web/
RUN cd web && npm ci

COPY web ./web
RUN cd web && npm run build

FROM node:20-alpine

WORKDIR /app

# Chromium（qq-image-notify 渲染卡片用）+ 中文字体 + 运行依赖
RUN apk add --no-cache tini su-exec tzdata \
    chromium \
    font-noto-cjk \
    font-noto-emoji \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    && rm -rf /var/cache/apk/*

ENV TZ=Asia/Shanghai
ENV QQ_CARD_CHROMIUM=/usr/bin/chromium
# 强制使用官方 npm registry（node 镜像默认 npmmirror 偶发 503，拖垮构建）
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY plugins ./plugins
COPY --from=builder /app/web/dist ./web/dist

RUN mkdir -p /app/data && chown -R node:node /app

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/miotify.db

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
