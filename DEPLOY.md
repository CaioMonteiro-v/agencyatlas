# Atlas Agency — Deploy confiável

Este app agora sobe com **Docker**. Isso evita o erro de `better-sqlite3`/`vite` e funciona melhor em hospedagens gratuitas.

## Login da equipe

Acesse `/login`:
1. **Primeiro acesso:** tela “Criar conta” (nome, usuário, senha) — libera o painel
2. **Depois:** Entrar com usuário/senha
3. **Novos membros (opcional):** no Render, defina `ATLAS_INVITE_CODE=seu-codigo` para permitir “Criar conta” com convite

Variáveis úteis:
```text
ATLAS_AUTH_SECRET=um-segredo-longo-aleatorio
ATLAS_INVITE_CODE=atlas-mt-2026
```

Opcional (legado): `ATLAS_TEAM_USER` + `ATLAS_TEAM_PASSWORD` ainda funcionam como login de emergência.

- Painel (`/campanha`, `/admin`) exige login
- QR de evento (`/evento/...`) e link de mobilizador (`/m/...`) continuam **públicos**

---

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

## Opção 2 — Render (Node)

1. Web Service → repo `agencyatlas`
2. **Branch: `cursor/atlas-agency-platform-b8e1`** (não use `main` antigo — lá o build quebra e falta o app atual)
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Environment: `DATABASE_URL` (Supabase) + `NODE_VERSION=20.18.1`

Se o log mostrar `Checking out commit ... in branch main`, troque em **Settings → Build & Deploy → Branch**.

Runtime **Docker** também funciona (ver abaixo).

---

## Opção 2b — Render com Docker

Se quiser continuar no Render com Docker:

1. New Web Service → repo `agencyatlas`
2. Runtime: **Docker**
3. Branch: `cursor/atlas-agency-platform-b8e1`
4. Dockerfile path: `./Dockerfile`
5. Create Web Service
6. Environment: `DATABASE_URL` (Supabase)
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
- **Dados do SQLite RESETAM** quando o container é recriado (redeploy / sleep do free)
- Por isso cadastros e eventos podem “sumir” (ex.: Bianca, eventos de ontem)

### Solução recomendada: Supabase (Postgres)

1. Crie um projeto em [https://supabase.com](https://supabase.com)
2. Vá em **Project Settings → Database**
3. Copie a **Connection string** (URI) — modo **Session** ou **URI**
   - Ex.: `postgresql://postgres.[ref]:[SENHA]@aws-0-....supabase.com:5432/postgres`
4. No Render → Environment, adicione:
   - `DATABASE_URL` = essa URI
5. **Prefira a connection string do pooler (Session)** se a Direct falhar:
   - No Supabase → **Connect → Connection pooling → Session**
   - Formato típico:
     `postgresql://postgres.[PROJECT]:[SENHA]@aws-0-....pooler.supabase.com:5432/postgres`
6. **Manual Deploy**

Com `DATABASE_URL` o Atlas usa Postgres/Supabase automaticamente. Os dados **não somem** no redeploy.

Sem `DATABASE_URL`, continua SQLite local (só para desenvolvimento).

### Alternativa: disco persistente no Render
1. Serviço → **Disks** (plano pago)
2. Mount path: `/app/server/data`
3. Redeploy

## Alimentar o sistema

- Admin: `/admin`
- Mobilização: links, eventos/QR, missões, cadastros
- Coordenadores: expectativa de voto, meta de conteúdo e alarmes
- Relatório: briefing + folha de ligação + Atlas Assistente

---

## Integrações (opcional)

### Meta / Instagram Graph API

No painel da campanha (aba Coordenadores) existe o botão **Sincronizar Instagram (Meta)**.

Variáveis de ambiente no Render / Docker:

```bash
META_ACCESS_TOKEN=EAAB...
META_IG_USER_ID=17891...
META_GRAPH_VERSION=v21.0
```

Sem essas variáveis o sistema funciona em **modo manual**: você informa views, reach e comentários por município na aba Coordenadores.

> O Instagram não entrega geolocalização municipal nativa sem Ads. O sync distribui o engajamento da conta proporcionalmente às metas de views de cada município.

### Bitly Analytics

Na aba **Mobilização → Conteúdos mobilizados**, o painel mostra análise estilo Bitly (cliques) + grupos/canais e pessoas.

```bash
BITLY_ACCESS_TOKEN=seu-token-bitly
```

Com o token: botão **Atualizar do Bitly** puxa total de cliques e série dos últimos 30 dias.  
Sem o token: informe o total de cliques manualmente (como no painel do Bitly) e cadastre os grupos/canais.

### Atlas Assistente (IA)

A aba **Relatório** gera um briefing local automaticamente.

Para enriquecer com OpenAI:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Sem a chave, a assistente local (regras) continua funcionando.
