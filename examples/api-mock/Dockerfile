# syntax=docker/dockerfile:1
# API Mock Studio — standalone listener for CI (Phase 8E).
# Build from the repository root:
#   docker build -f examples/api-mock/Dockerfile -t redfireforge-api-mock .
#   docker run --rm -p 4600:4600 redfireforge-api-mock
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 4600
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD node -e "fetch('http://127.0.0.1:4600/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx","tsx","cli/index.ts","mock","start","examples/api-mock/sample-workspace.json","--standalone","--wait-ready"]
