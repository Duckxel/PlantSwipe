FROM node:22-slim AS base
WORKDIR /app

# Install full dependency tree (including dev deps) for building
FROM base AS deps
COPY plant-swipe/package*.json ./
RUN npm ci

FROM deps AS builder
COPY plant-swipe ./
RUN npm run build
# Drop the dev dependency tree so we don't copy it into the runtime image
RUN rm -rf node_modules

# Install only the production deps for the runtime image
FROM base AS prod-deps
COPY plant-swipe/package*.json ./
RUN npm ci --omit=dev

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PLANTSWIPE_REPO_DIR=/app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "server.js"]
