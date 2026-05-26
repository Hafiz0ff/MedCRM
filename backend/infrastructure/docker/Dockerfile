FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

FROM node:24-alpine AS builder
ARG APP_NAME
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build:${APP_NAME}

FROM node:24-alpine AS runner
ARG APP_NAME
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
ENV APP_NAME=${APP_NAME}
CMD ["sh", "-c", "if [ \"$APP_NAME\" = \"auth-service\" ]; then npm run prisma:migrate && npm run prisma:seed; fi && npm run start:prod:${APP_NAME}"]
