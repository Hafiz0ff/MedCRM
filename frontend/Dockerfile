FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./frontend/.next/static
COPY --from=builder /app/public ./frontend/public
CMD ["node", "frontend/server.js"]
