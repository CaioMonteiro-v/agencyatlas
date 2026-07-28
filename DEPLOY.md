# Atlas Agency — Deploy confiável

Este app agora sobe com **Docker**. Isso evita o erro de `better-sqlite3`/`vite` e funciona melhor em hospedagens gratuitas.

## Opção 1 — Koyeb (recomendada)

Mais estável para começar rápido.

1. Crie conta em [https://www.koyeb.com](https://www.koyeb.com) com GitHub
2. **Create App → GitHub**
3. Selecione o repo `agencyatlas`
4. Branch: `cursor/atlas-agency-platform-b8e1` (ou `main` após merge)
5. Builder: **Dockerfile** (deve detectar automaticamente)
6. Porta: `3000`
7. Região: a mais próxima (Washington / Frankfurt)
8. Instance: **Free / Nano**
9. Deploy

URL final algo como:
`https://agencyatlas-xxxx.koyeb.app`

### Depois do deploy
1. Abra a URL
2. Vá em `/campanha/fabio-garcia/mobilizacao`
3. Em Eventos → **URL pública dos QR Codes** = a URL do Koyeb
4. Clique **Atualizar QR Codes**
5. Teste no celular

---

## Opção 2 — Render com Docker

Se quiser continuar no Render:

1. New Web Service → repo `agencyatlas`
2. Runtime: **Docker**
3. Branch: `cursor/atlas-agency-platform-b8e1`
4. Dockerfile path: `./Dockerfile`
5. Create Web Service

---

## Opção 3 — Fly.io

```bash
# no seu PC, com o projeto clonado
fly launch --dockerfile Dockerfile --name atlas-agency
fly apps open
```

---

## Build local (para validar)

```bash
docker build -t atlas-agency .
docker run --rm -p 3000:3000 atlas-agency
```

Abra: http://localhost:3000

---

## Importante sobre plano free

- App pode “dormir” sem acesso (cold start de 20–60s)
- Dados do SQLite podem resetar se o container for recriado
- Para produção séria depois: Postgres (Neon) + plano pago

## Alimentar o sistema

- Admin: `/admin`
- Mobilização: links, eventos/QR, missões, cadastros
