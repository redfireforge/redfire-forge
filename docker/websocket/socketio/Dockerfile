FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
EXPOSE 3100
HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1
CMD ["node", "server.js"]
