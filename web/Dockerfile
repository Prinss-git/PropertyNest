# One image for both processes:
#   web:     docker run ... propertynest            (npm start, port 3000)
#   worker:  docker run ... propertynest npm run worker
#   release: docker run ... propertynest npx prisma migrate deploy   (before starting a new version)
#
# The build pre-renders the home page and sitemap from the database, so it needs DATABASE_URL:
#   docker build --build-arg DATABASE_URL=... --build-arg SITE_URL=https://propertynest.ph \
#     --build-arg NEXT_PUBLIC_MAP_TILE_URL=... --build-arg NEXT_PUBLIC_MAP_ATTRIBUTION=... -t propertynest .
# Build arguments stay in the build stage; the final image only gets settings at run time (-e / --env-file).

FROM node:24-slim AS base
WORKDIR /app
# openssl: Prisma's database engine; ca-certificates: HTTPS to SMS, email, storage and map services.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
ARG DATABASE_URL
ARG SITE_URL
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
ARG MEDIA_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM base AS runtime
# UPLOAD_DIR only matters with STORAGE_DRIVER=local (then mount a volume there). Health check: GET /api/health.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 UPLOAD_DIR=/app/.uploads
COPY --from=build /app ./
# Run as the unprivileged "node" user that the base image provides.
RUN mkdir -p /app/.uploads && chown -R node:node /app/.uploads
USER node
EXPOSE 3000
CMD ["npm", "start"]
