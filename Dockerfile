FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

# Root: só deps de produção | Client: precisa do Vite (devDependency) para build
RUN npm ci --omit=dev \
  && npm ci --prefix client

COPY . .

RUN npm run build --prefix client \
  && mkdir -p /app/server/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
