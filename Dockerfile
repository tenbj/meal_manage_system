FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm ls --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
COPY docs ./docs
COPY scripts/migrate.js ./scripts/migrate.js
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime && node -e "require('./src/app')"
USER node
ENV NODE_ENV=production AUTO_MIGRATE=false PORT=3200
EXPOSE 3200
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:3200/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","src/server.js"]
