FROM node:26-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
USER node
ENV NODE_ENV=production PORT=8080 DATA_PATH=/data/northline.sqlite
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
