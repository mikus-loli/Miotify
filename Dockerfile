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

RUN apk add --no-cache tini

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY plugins ./plugins
COPY --from=builder /app/web/dist ./web/dist

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/miotify.db

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
