# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

WORKDIR /app

# Set build-time environment variables FIRST
ARG NEXT_PUBLIC_API_URL=https://panel.dofer.com.mx/api/v1
ARG NEXT_PUBLIC_SUPABASE_URL=https://gbgsezsonympmnkbzww.supabase.co
ARG NEXT_PUBLIC_SUPABASE_KEY=sb_publishable_mLiv8zDPfforC1MH0zhsmQ_WVKIVyTp

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_KEY=${NEXT_PUBLIC_SUPABASE_KEY}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# ===== RUNTIME STAGE =====
FROM node:20-alpine

WORKDIR /app

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create non-root user ANTES de copiar archivos
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiar archivos con --chown para asignar ownership correcto desde el inicio
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pre-crear directorio de caché de imágenes con permisos correctos
RUN mkdir -p .next/cache/images && chown -R nextjs:nodejs .next/cache

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Standalone mode usa node server.js en vez de npm start
CMD ["node", "server.js"]
