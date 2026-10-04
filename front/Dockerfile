# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Altitude · Control de proyectos
# Next.js 16 en modo standalone. Corre en el puerto 3001 para no chocar con
# otra app que ya use el 3000.
#
# El contenedor necesita en tiempo de ejecución AUTH_SECRET y la conexión a
# Odoo (ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY). Ver docker-compose.yml.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app

# Las variables NEXT_PUBLIC_* se incrustan al compilar, no al arrancar.
ARG NEXT_PUBLIC_DEMO_MODE=
ARG NEXT_PUBLIC_BRAND_MARK=""
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_BRAND_MARK=$NEXT_PUBLIC_BRAND_MARK
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `postbuild` copia public/ y .next/static dentro de .next/standalone
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs
EXPOSE 3001

CMD ["node", "server.js"]
