# Supabase / Postgres — Atlas Agency

## Por que migrar
No Render free o SQLite some em redeploy. Com Supabase (Postgres) os dados ficam salvos.

O free do Supabase **já cobre** o uso da campanha:
- **Postgres (500 MB):** cadastros de lideranças, mobilizadores, eventos, demandas (texto/status)
- **Storage (1 GB):** prints/WhatsApp do funil de demandas

São quotas **separadas** — imagens não “comem” o espaço dos cadastros.

## Passo a passo — banco (obrigatório)
1. Crie conta/projeto em https://supabase.com
2. No projeto: **Connect → Connection pooling → Session → URI**
   - Evite **Direct connection** no Render free (pode falhar por IPv6)
3. Copie a URI e coloque a senha do banco (sem colchetes `[ ]`)
4. No Render (`agencyatlas-1`) → **Environment** → **Edit**:
   - KEY: `DATABASE_URL`
   - VALUE: a URI
5. Save → **Manual Deploy → Deploy latest commit**
6. Teste: `https://agencyatlas-1.onrender.com/api/health`
   - Deve mostrar `"database":"postgres"`

## Passo a passo — prints permanentes (Storage)
Sem isso, prints ficam no disco do Render e **podem sumir** no redeploy.

1. No Supabase → **Project Settings → API**
2. Copie:
   - **Project URL** → `SUPABASE_URL` (ex.: `https://xxxx.supabase.co`)
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. No Render → Environment, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. (Opcional) `SUPABASE_STORAGE_BUCKET=atlas-demands`
5. Redeploy

No primeiro upload o Atlas cria o bucket público `atlas-demands` sozinho.

Teste: `/api/health` deve mostrar:
```json
"storage": { "configured": true, "provider": "supabase", "bucket": "atlas-demands" }
```

Novas demandas com imagem passam a gravar no Storage. Demandas antigas com print local
podem perder a imagem após redeploy — reenvie o print se precisar.

## Formato esperado (pooler Session)
```text
postgresql://postgres.SEU_PROJECT_REF:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

## Se der erro de conexão
1. Troque a URI Direct pela **Session pooler**
2. Confirme a senha (sem `[` `]`)
3. Redeploy

## Observações
- Sem `DATABASE_URL`, o app usa SQLite (dev / fallback)
- Sem `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, prints caem no disco local (só ok em dev)
- As tabelas são criadas automaticamente no primeiro start
- Seed cria a campanha Fábio Garcia + 142 municípios se ainda não existirem
- **Free pause:** projeto free do Supabase pode pausar após ~1 semana sem uso — abra o painel Supabase e dê Resume
- **service_role** é segredo de servidor: nunca coloque no frontend / GitHub
