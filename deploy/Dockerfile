# Build Astro with --base / and package using scripts/build-server.mjs first.
# This image contains public assets and source only; secrets arrive at runtime.
FROM node:24-slim
ENV NODE_ENV=production
ENV PORT=8787
ENV PAPER4QI_DB_PATH=/var/lib/paper4qi/library.sqlite
WORKDIR /app
COPY dist/standalone/ /app/
RUN groupadd --system paper4qi && useradd --system --gid paper4qi paper4qi && mkdir -p /var/lib/paper4qi && chown paper4qi:paper4qi /var/lib/paper4qi
USER paper4qi
VOLUME ["/var/lib/paper4qi"]
EXPOSE 8787
CMD ["node", "app.mjs"]
