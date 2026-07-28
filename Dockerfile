FROM node:20-bookworm-slim

WORKDIR /app

# Dependências do sistema (mínimas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Instala deps primeiro (cache de layer)
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

RUN npm ci --omit=dev \
  && npm ci --prefix client

# Código
COPY . .

# Build do frontend
RUN npm run build --prefix client

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Persistência do SQLite (sql.js) dentro do container
RUN mkdir -p /app/server/data

CMD ["npm", "start"]
