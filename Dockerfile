ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY web/package*.json ./web/
RUN cd web && npm ci --ignore-scripts

COPY . .
RUN cd web && npm run build

FROM node:${NODE_VERSION} AS runtime

RUN apk add --no-cache tini && \
    addgroup -g 1000 -S miotify && \
    adduser -u 1000 -S miotify -G miotify

WORKDIR /app

COPY --from=builder --chown=miotify:miotify /app/node_modules ./node_modules
COPY --from=builder --chown=miotify:miotify /app/src ./src
COPY --from=builder --chown=miotify:miotify /app/plugins ./plugins
COPY --from=builder --chown=miotify:miotify /app/web/dist ./web/dist
COPY --from=builder --chown=miotify:miotify /app/package.json ./

RUN mkdir -p /app/data && chown -R miotify:miotify /app/data

USER miotify

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/miotify.db

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
