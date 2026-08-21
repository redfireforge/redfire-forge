FROM node:22-alpine

WORKDIR /app
COPY server.mjs ./

ENV PORT=4017
# wget/node fetch inherit HTTP_PROXY from Docker Desktop and miss loopback.
ENV NO_PROXY=localhost,127.0.0.1,::1
ENV no_proxy=localhost,127.0.0.1,::1
EXPOSE 4017

HEALTHCHECK --interval=5s --timeout=5s --retries=12 --start-period=5s \
    CMD node -e "fetch('http://127.0.0.1:4017/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
