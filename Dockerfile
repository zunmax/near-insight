# One image for both services: `web` (Next.js server) and `worker` (ingest jobs), started with different commands.
# Node 24 runs the worker's TypeScript directly (type stripping) and provides the built-in node:sqlite. The base image is
# pinned by digest, so a rebuild uses exactly the image it was tested with.

FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# SITE_URL and NEWS_EVENTS_URL are read at build time for metadata and the content security policy.
ARG SITE_URL
ARG NEWS_EVENTS_URL
ENV SITE_URL=${SITE_URL} NEWS_EVENTS_URL=${NEWS_EVENTS_URL} NEXT_TELEMETRY_DISABLED=1
# Development-only packages (linting, types, the CSS compiler) are left out of the image once the build has used them.
RUN npm run build && npm prune --omit=dev

FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
WORKDIR /app
# The worker's Dune reader (src/ingest/sources/dune.py) runs on Python with curl_cffi, kept in its own virtual environment.
COPY requirements.txt ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /opt/dune \
  && /opt/dune/bin/pip install --no-cache-dir -r requirements.txt
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATABASE_PATH=/app/data/dashboard.db DUNE_PYTHON=/opt/dune/bin/python
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/src ./src
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3000 8081
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
