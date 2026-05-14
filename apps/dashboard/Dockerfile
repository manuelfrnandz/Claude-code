# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/dashboard/package*.json ./apps/dashboard/
RUN npm ci --workspace=apps/dashboard

COPY apps/dashboard/ ./apps/dashboard/
RUN npm run build --workspace=apps/dashboard

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY apps/dashboard/package*.json ./apps/dashboard/
RUN npm ci --workspace=apps/dashboard --omit=dev

COPY --from=builder /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=apps/dashboard"]
