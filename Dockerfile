# Pizza_App: ein Container, ein Port, ein Volume.
# Gebaut wird ausschliesslich von GitHub Actions, siehe .github/workflows/build.yml.

# ---- Stufe 1: Abhängigkeiten für den Betrieb ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 # Früh scheitern, falls die nativen Module für diese Plattform fehlen
 && node -e "new (require('better-sqlite3'))(':memory:').close(); require('argon2')"

# ---- Stufe 2: schlankes Laufzeit-Image ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8093 \
    TZ=Europe/Zurich
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8093
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.js"]
