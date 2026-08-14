FROM node:22-alpine

WORKDIR /app
COPY server.mjs ./

ENV PORT=4017
EXPOSE 4017

HEALTHCHECK --interval=5s --timeout=5s --retries=12 --start-period=5s \
  CMD wget -q --spider http://localhost:4017/health || exit 1

CMD ["node", "server.mjs"]
