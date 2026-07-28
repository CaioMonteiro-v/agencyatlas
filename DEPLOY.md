# Deploy gratuito — Atlas Agency

## Opção recomendada: Render (grátis)

### 1. Conta
1. Crie conta em [https://render.com](https://render.com)
2. Conecte o GitHub (`CaioMonteiro-v/agencyatlas`)

### 2. Criar Web Service
1. **New +** → **Web Service**
2. Selecione o repositório `agencyatlas`
3. Branch: `main` (ou `cursor/atlas-agency-platform-b8e1` enquanto o PR não mergear)
4. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm run install:all && npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. Clique em **Create Web Service**

Em alguns minutos você recebe uma URL tipo:
`https://atlas-agency-xxxx.onrender.com`

### 3. Importante sobre o plano free
- O app **dorme** após ~15 min sem acesso (primeira abertura pode demorar ~30–60s)
- O SQLite no disco free **pode zerar** se o serviço for recriado/reiniciado do zero
- Para dados permanentes depois, o caminho é Postgres gratuito (Neon/Supabase) — posso migrar quando quiser

---

## Alternativa: Railway

1. [https://railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Build/Start iguais ao Render
4. Gere domínio público em Settings → Networking

---

## Como alimentar o sistema

### Pelo painel Admin (principal)
Abra: `https://SUA-URL/admin`

Lá você consegue:
- Criar **novas campanhas**
- Cadastrar **lideranças** (política ou multiplicador) por município

### Dentro de cada campanha → aba Mobilização
- **Eventos:** criar evento e gerar QR Code
- **Missões:** criar metas e atualizar progresso (+5 / +10)
- **Links parametrizados:** copiar e enviar para cada liderança
- **Cadastros:** entram sozinhos quando alguém usa o link `/r/fabio-garcia/CODIGO`

### Formulário público de cadastro
Cada liderança tem um link:
`/r/fabio-garcia/CODIGO_DA_LIDERANCA`

Quem preenche alimenta automaticamente:
- tabela de cadastros
- ranking
- mapa de calor

### Eventos (QR Code)
1. Crie o evento na mobilização
2. Baixe/mostre o QR
3. Pessoas abrem `/evento/slug-do-evento` e se inscrevem

### Seed inicial (demo)
Na primeira subida o sistema já cria dados de exemplo da campanha Fábio Garcia.
Se quiser resetar localmente:
```bash
rm -f server/data/atlas.db*
npm run seed
```

---

## Checklist pós-deploy
1. Abrir a URL e testar a home
2. Entrar em `/campanha/fabio-garcia/mobilizacao`
3. Abrir `/admin` e criar uma liderança de teste
4. Copiar o link parametrizado e fazer 1 cadastro
5. Confirmar que o ranking e o mapa atualizam
