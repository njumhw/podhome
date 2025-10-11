#!/usr/bin/env bash
set -euo pipefail

# PodHome deployment script
# Usage: ./deploy.sh

echo "[PodHome] Starting deployment..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[PodHome] pnpm not found. Installing corepack and enabling pnpm..."
  corepack enable || true
  corepack prepare pnpm@10.17.1 --activate
fi

# Ensure env exists
if [ ! -f .env ]; then
  echo "[PodHome] .env not found. Please copy .env.example to .env and fill values." >&2
  exit 1
fi

export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

echo "[PodHome] Installing dependencies..."
pnpm install --frozen-lockfile

# Database
if command -v npx >/dev/null 2>&1; then
  echo "[PodHome] Applying database schema (prisma db push)..."
  pnpm db:push || true
  echo "[PodHome] Generating Prisma client..."
  pnpm prisma:generate
fi

echo "[PodHome] Building Next.js app..."
pnpm build

echo "[PodHome] Starting server..."
# Prefer process manager if available
if command -v pm2 >/dev/null 2>&1; then
  pm2 start "pnpm start" --name podroom --time --update-env || pm2 restart podroom --update-env
  pm2 save || true
  echo "[PodHome] App managed by pm2 as 'podroom'"
else
  # Fallback foreground start
  pnpm start
fi
