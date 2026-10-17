# syntax=docker.io/docker/dockerfile:1

# Packages an app that was already built on the CI runner (see
# .github/workflows/build_and_deploy.yml). Expects these to exist:
#   .next/standalone, .next/static  -> from `next build`
#   public-compressed               -> from `node copyPublicAndCompressImages.js public public-compressed`
# Debian-based (glibc) so native modules built on the ubuntu runner work.
FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public-compressed ./public

# Migrations are loaded from disk at runtime by node-pg-migrate (not traced
# by Next.js), so they need to be copied into the image explicitly.
COPY --chown=nextjs:nodejs migrations ./migrations

USER nextjs

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
