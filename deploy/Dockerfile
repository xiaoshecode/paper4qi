FROM node:24-bookworm-slim
RUN groupadd --gid 10001 paper4qi \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin paper4qi \
    && mkdir -p /app /var/lib/paper4qi \
    && chown 10001:10001 /app /var/lib/paper4qi
WORKDIR /app
COPY --chown=10001:10001 app.mjs sqlite-d1.mjs worker.mjs workspace-api.mjs chat-api.mjs /app/
COPY --chown=10001:10001 drizzle /app/drizzle
USER 10001:10001
ENV NODE_ENV=production \
    PORT=8787 \
    PAPER4QI_BIND_HOST=0.0.0.0 \
    PAPER4QI_DB_PATH=/var/lib/paper4qi/library.sqlite
EXPOSE 8787
VOLUME ["/var/lib/paper4qi"]
CMD ["node", "/app/app.mjs"]
