# Atlas Agency

Plataforma web completa para gestão de campanhas eleitorais e mobilização digital.

## Stack

- **Frontend:** React + Vite + React Router + Leaflet (OpenStreetMap)
- **Backend:** Node.js + Express
- **Banco:** SQLite (better-sqlite3)
- **QR Code:** `qrcode`
- **WhatsApp:** link `https://bit.ly/FalaFabio`

## Como rodar

```bash
npm run install:all
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

Produção:

```bash
npm run install:all
npm run build
npm start
```

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
