# syntax=docker/dockerfile:1.7

# --- Base ---
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate \
  && apk add --no-cache libc6-compat
WORKDIR /app

# --- Pruner ---
FROM base AS pruner
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch --prod

# --- Builder ---
FROM base AS builder
COPY --from=pruner /pnpm /pnpm
COPY --from=pruner /app/node_modules /app/node_modules
COPY pnpm-lock.yaml package.json ./
COPY tsconfig.json ./
COPY next.config.ts* ./
COPY postcss.config.mjs* ./
COPY tailwind.config.ts* ./
COPY src ./src
COPY public ./public
RUN pnpm install --offline && pnpm build

# --- Runner ---
FROM base AS runner
ENV NODE_ENV=production
# Next standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
