# Atlas Agency

Plataforma web completa para gestão de campanhas eleitorais e mobilização digital.

## Stack

- **Frontend:** React + Vite + React Router + Leaflet (OpenStreetMap)
- **Backend:** Node.js + Express
- **Banco:** SQLite (better-sqlite3)
- **QR Code:** `qrcode`
- **WhatsApp:** link `https://bit.ly/FalaFabio`

## Como rodar (local)

```bash
npm run install:all
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

Produção local:

```bash
npm run install:all
npm run build
npm start
```

## Hospedagem gratuita + alimentar dados

Guia completo em **[DEPLOY.md](./DEPLOY.md)**.

Resumo rápido (Render):
1. Conta em [render.com](https://render.com) → conectar GitHub
2. New Web Service no repo `agencyatlas`
3. Build: `npm run install:all && npm run build`
4. Start: `npm start`
5. Alimentar em `/admin` e na aba Mobilização da campanha

## Funcionalidades

- Página principal da Atlas Agency com missão, serviços e dashboard
- Módulo da campanha **Fábio Garcia** com abas Visão Geral, Mobilização, Mídia e Conteúdo
- Mapa de calor interativo de Mato Grosso com detalhe por município
- Ranking de lideranças em tempo real (políticas × multiplicadores)
- Links parametrizados rastreáveis
- Registro detalhado de cadastros
- Eventos com geração de QR Code e formulário público
- Missões/metas com impacto no ranking
- Administração para criar campanhas e lideranças
