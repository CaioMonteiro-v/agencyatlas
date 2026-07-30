# Supabase / Postgres — Atlas Agency

## Por que migrar
No Render free o SQLite some em redeploy. Com Supabase (Postgres) os dados ficam salvos.

## Passo a passo
1. Crie conta/projeto em https://supabase.com
2. **Project Settings → Database → Connection string → URI**
3. Substitua `[YOUR-PASSWORD]` pela senha do banco
4. No Render (`agencyatlas-1`) → **Environment** → **Edit**:
   - KEY: `DATABASE_URL`
   - VALUE: a URI do Supabase
5. Save → **Manual Deploy → Deploy latest commit**
6. Teste: `https://agencyatlas-1.onrender.com/api/health`
   - Deve mostrar `"database":"postgres"`

## Observações
- Sem `DATABASE_URL`, o app usa SQLite (dev / fallback)
- As tabelas são criadas automaticamente no primeiro start
- Seed cria a campanha Fábio Garcia + 142 municípios se ainda não existirem
- Guarde a senha do Supabase em local seguro
