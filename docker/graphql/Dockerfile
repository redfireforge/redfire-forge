FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=4010
EXPOSE 4010

HEALTHCHECK --interval=5s --timeout=5s --retries=12 --start-period=10s \
  CMD wget -q --spider http://localhost:4010/health || exit 1

CMD ["node", "server.js"]
