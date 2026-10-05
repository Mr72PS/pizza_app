# Pizza_App: ein Container, ein Port, ein Volume.
# Gebaut wird ausschliesslich von GitHub Actions, siehe .github/workflows/build.yml.

# ---- Stufe 1: Abhängigkeiten für den Betrieb ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 wird beim Installieren übersetzt; die Werkzeuge dafür bleiben in dieser Stufe
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
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
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir /data && chown node:node /data
# Kein USER: Der Einstieg richtet als root die Rechte auf /data und wechselt dann auf PUID:PGID (Vorgabe 1000:1000)
VOLUME /data
EXPOSE 8093
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
