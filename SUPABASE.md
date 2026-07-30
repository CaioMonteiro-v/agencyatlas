# Supabase / Postgres — Atlas Agency

## Por que migrar
No Render free o SQLite some em redeploy. Com Supabase (Postgres) os dados ficam salvos.

## Passo a passo
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
- As tabelas são criadas automaticamente no primeiro start
- Seed cria a campanha Fábio Garcia + 142 municípios se ainda não existirem
