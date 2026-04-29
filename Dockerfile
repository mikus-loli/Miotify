FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY web/package*.json ./web/
RUN cd web && npm ci

COPY . .
RUN cd web && npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache tini

RUN addgroup -g 1000 -S miotify && \
    adduser -u 1000 -S miotify -G miotify

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY src ./src
COPY plugins ./plugins
COPY --from=builder /app/web/dist ./web/dist

RUN mkdir -p /app/data && chown -R miotify:miotify /app

USER miotify

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
