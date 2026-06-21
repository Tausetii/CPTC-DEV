# Build stage: native deps (better-sqlite3) compile here if no prebuilt binary.
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev

# Runtime stage: slim image, non-root, no build toolchain.
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package.json server.js store.js ./
COPY bin ./bin
COPY admin ./admin
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 7000 7700
# Default command runs the data plane; the admin service overrides it.
CMD ["node", "server.js"]
