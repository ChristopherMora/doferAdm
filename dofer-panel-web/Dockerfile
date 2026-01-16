# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
ARG NEXT_PUBLIC_API_URL=http://31.220.55.210:9001
ARG NEXT_PUBLIC_SUPABASE_URL=https://gbgsezsonympmnkbzww.supabase.co
ARG NEXT_PUBLIC_SUPABASE_KEY=sb_publishable_mLiv8zDPfforC1MH0zhsmQ_WVKIVyTp

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_KEY=${NEXT_PUBLIC_SUPABASE_KEY}

RUN npm run build

# ===== RUNTIME STAGE =====
FROM node:20-alpine

WORKDIR /app

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Copy built app from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start the app
CMD ["npm", "start"]
