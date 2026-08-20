# RedfireForge API Mock — Docker Image
#
# Production form: installs redfireforge-cli from npm (published as redfireforge-cli).
# TODO(publish): once the package is on npm, this image is ready to push to Docker Hub
#                as redfireforge/rff-mock:<version>.
#
# Usage:
#   docker run --rm \
#     -v $(pwd)/mocks/orders.json:/workspace/mock.json:ro \
#     -p 4600:4600 \
#     redfireforge/rff-mock:latest
#
# The mock definition file is expected at /workspace/mock.json unless overridden
# via CMD or ENV variable (see ENTRYPOINT below).

FROM node:20-alpine

# ─── Install CLI ─────────────────────────────────────────────────────────────
# TODO(publish): replace with `npm install -g redfireforge-cli` once published.
# For local/dev builds use Dockerfile.dev which COPYs from the monorepo dist.
RUN npm install -g redfireforge-cli 2>/dev/null || true

# ─── Runtime user (non-root) ─────────────────────────────────────────────────
RUN addgroup -S rff && adduser -S rff -G rff
USER rff

# ─── Mock definition mount point ─────────────────────────────────────────────
# Mount your workspace definition JSON here at runtime:
#   docker run -v ./mocks/api.json:/workspace/mock.json ...
# Or COPY it in a derived image:
#   FROM redfireforge/rff-mock
#   COPY mocks/api.json /workspace/mock.json
WORKDIR /workspace

# ─── Network ─────────────────────────────────────────────────────────────────
EXPOSE 4600
ENV RFF_MOCK_PORT=4600
ENV RFF_MOCK_FILE=/workspace/mock.json

# ─── Health probe ─────────────────────────────────────────────────────────────
# Uses the built-in /__rff/health/ready endpoint (readiness: routes committed).
# Liveness:  GET /__rff/health/live  → 200 immediately after start
# Readiness: GET /__rff/health/ready → 200 once ≥1 route generation committed
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=6 \
  CMD wget -qO- "http://localhost:${RFF_MOCK_PORT}/__rff/health/ready" | grep -q '"status":"ok"' || exit 1

# ─── Entrypoint ──────────────────────────────────────────────────────────────
# --standalone: run in-process (no companion server needed inside the container)
# --port:       bind to $RFF_MOCK_PORT (default 4600)
# Override CMD to pass a different definition file:
#   docker run redfireforge/rff-mock rff mock start /data/my-def.json --standalone --port 4600
ENTRYPOINT ["sh", "-c", "exec rff mock start \"${RFF_MOCK_FILE}\" --standalone --port \"${RFF_MOCK_PORT}\""]
