FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY web/package*.json ./web/
RUN cd web && npm ci

COPY web ./web
RUN cd web && npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini su-exec

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
