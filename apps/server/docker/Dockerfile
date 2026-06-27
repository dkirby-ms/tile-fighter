FROM node:22-alpine AS builder

WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json tsconfig.json .eslintrc.cjs ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
RUN npm run -w @game/server build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/package-lock.json ./package-lock.json
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/server/package.json ./apps/server/package.json
COPY --from=builder /workspace/apps/server/dist ./apps/server/dist
COPY --from=builder /workspace/packages ./packages

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]