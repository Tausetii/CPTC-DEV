FROM node:20-bookworm-slim

# Prisma needs OpenSSL for its query engine on debian-slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 6767
ENV PORT=6767 HOST=0.0.0.0 NODE_ENV=production
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts || true; node build"]
