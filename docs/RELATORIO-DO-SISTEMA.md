# Relatório do Sistema Atlas Agency

**Para quem:** equipe da campanha (incluindo quem não programa)  
**Objetivo:** entender o que o sistema faz, como as pessoas entram, o que cada aba resolve, e como testar o fluxo completo.

---

## 1. O que é o Atlas, em uma frase

O Atlas é o **painel de operação da campanha**. Ele organiza:

- quem se cadastra (QR, link de mobilizador, link de liderança);
- quem cuida de cada cidade (coordenadores);
- os grupos de WhatsApp da dobra (por Deputado Estadual);
- os vídeos e links Bitly (para saber quem clicou);
- o que aconteceu / o que falta resolver em cada município;
- o dossiê do que o mandato/campanha entregou nas cidades;
- o conteúdo da semana (quem deve dobrar onde).

Não é só um site bonito: é a **ferramenta do dia a dia** da equipe.

**Campanha principal neste projeto:** Fábio Garcia (Deputado Federal / MT).

**Site no ar (exemplo):** `https://agencyatlas-1.onrender.com`

---

## 2. Quem usa o sistema

| Quem | O que faz |
|------|-----------|
| **Equipe Atlas (painel)** | Entra com login, vê todas as abas, cadastra eventos, grupos, Bitlys, relatórios etc. |
| **Pessoa do povo (público)** | Não faz login. Só usa QR ou link e preenche nome + telefone (e-mail opcional). |
| **Admin** | Mesma visão da equipe, com privilégio extra para criar campanhas e usuários (primeiro cadastro / perfil admin). |

Na prática do painel: **quem está logado vê a campanha inteira**. Não existe hoje um perfil “só coordenador de campo” separado.

---

## 3. Como uma pessoa entra na base (3 portas)

Tudo começa com **cadastro**: a pessoa deixa nome e telefone.

### Porta 1 — QR Code de evento

1. A equipe cria um **evento** na aba Mobilização.
2. Baixa o **QR Code**.
3. No dia, a pessoa aponta a câmera do celular.
4. Abre o formulário público: nome + telefone (e-mail opcional).
5. Confirma → o sistema salva o cadastro e pode abrir WhatsApp / grupo do evento.
6. A equipe acompanha ao vivo no **Radar do evento**.

### Porta 2 — Link do mobilizador

1. A equipe cria um **mobilizador** (pessoa de campo) com um código pessoal.
2. O link fica no formato: `/m/NOME-DA-CAMPANHA/CODIGO`.
3. A pessoa se cadastra → o crédito fica **no nome daquele mobilizador**.
4. Depois pode ir para o WhatsApp do candidato.

### Porta 3 — Link da liderança

1. No Admin, cria-se uma **liderança**.
2. O link fica no formato: `/r/NOME-DA-CAMPANHA/CODIGO`.
3. Cadastro creditado à **liderança** (aparece no ranking e no perfil dela).

**Importante:**  
**Cadastro** ≠ **clique no Bitly do vídeo**.  
- Cadastro = entrou na base.  
- Clique Bitly = abriu o link do vídeo (ou do convite do grupo).

---

## 4. Mapa das telas (o que cada aba faz)

### 4.1 Fora da campanha

| Tela | Para quê |
|------|----------|
| **Home** | Apresentação da Atlas; se logado, atalho às campanhas. |
| **Login** | Entrada da equipe (ou primeiro cadastro de usuário). |
| **Admin** | Criar campanha, lideranças, coordenadores e ligar municípios. |
| **Formulário de evento (QR)** | Cadastro público no celular. |
| **Link /m/...** | Cadastro via mobilizador. |
| **Link /r/...** | Cadastro via liderança. |
| **Radar do evento** | Tela ao vivo de quem acabou de se cadastrar no QR. |
| **Perfil da liderança** | Ficha, score, link e cadastros recentes. |

### 4.2 Dentro da campanha (menu de abas)

| Aba | Em linguagem simples |
|-----|----------------------|
| **Visão Geral** | Resumo rápido: quantos cadastros, lideranças, municípios, eventos; lista recente. |
| **Mobilização** | O “quartel general” do dia: mapa de Mato Grosso, ranking, links, lista de pessoas, mobilizadores, eventos/QR, missões e conteúdos Bitly avulsos. |
| **Coordenadores** | Como cada coordenador está nas cidades: metas, conteúdo, Instagram (se conectado), alarmes. |
| **Relatório** | Guia “Como funciona” + anotar o que aconteceu nas cidades + panorama para reunião. |
| **Investimento** | Dossiê do que foi entregue em cada município (Word/texto → PDF). |
| **Grupos Dobra** | Cards por **Deputado Estadual** → grupos de WhatsApp (foto, membros, convite). |
| **Bitly** | Quando sai um vídeo: 1 link Bitly **por grupo**; e também os convites de entrada no grupo. |
| **Mídia** | Ainda **em construção** (não use para operação hoje). |
| **Conteúdo** | Posts da semana e quem deve dobrar em cada cidade; Instagram opcional. |

---

## 5. A jornada completa programada (do zero ao teste)

Use esta sequência para **entender e testar** o sistema de ponta a ponta.

### Etapa A — Preparar a estrutura (uma vez)

1. Fazer **login** no painel.
2. Ir em **Admin**:
   - Confirmar/criar a **campanha**.
   - Cadastrar **coordenadores** (regional e/ou dobra) e ligar **municípios**.
   - Cadastrar **lideranças** (se for usar link `/r/...`).
3. Ir em **Grupos Dobra**:
   - Criar o card do **Deputado Estadual** (ex.: Beto Dois a Um).
   - Em cada deputado, cadastrar os **grupos de WhatsApp** (nome, foto, município, link de convite, membros).
4. (Opcional) Em **Mobilização**, criar **mobilizadores** de campo.

**Hierarquia da dobra (como o sistema pensa):**

```
Deputado Estadual
   → nosso coordenador da campanha (Atlas / Fábio) — opcional no card
   → coordenador das dobras
   → grupos de WhatsApp
```

> Atenção: o card é do **Deputado Estadual**, não do coordenador de campanha da cidade.  
> Exemplo: Beto Correa pode ser coordenador em Cuiabá, mas os grupos pertencem ao deputado **Beto Dois a Um**.

---

### Etapa B — Trazer gente para a base

**Teste 1 — Mobilizador**

1. Mobilização → criar/copiar link do mobilizador.  
2. Abrir o link no celular (modo anônimo).  
3. Cadastrar uma pessoa de teste.  
4. Conferir: lista de cadastros + mapa + crédito no mobilizador.

**Teste 2 — Liderança**

1. Copiar link `/r/...` da liderança.  
2. Cadastrar pessoa de teste.  
3. Conferir ranking / perfil da liderança.

**Teste 3 — Evento + QR**

1. Mobilização → Eventos → criar evento (nome, data, canal WhatsApp se tiver).  
2. Baixar QR.  
3. Abrir o link do evento no celular e cadastrar.  
4. Abrir o **Radar** e ver o nome aparecer.  
5. Confirmar na lista de inscritos e na base geral.

**Checklist deste bloco**

- [ ] Cadastro aparece na lista  
- [ ] Aparece no mapa (município certo, se informado)  
- [ ] Crédito no mobilizador **ou** liderança **ou** evento  
- [ ] QR abre no celular usando o **site no ar** (não “localhost”)

---

### Etapa C — Grupos e convite Bitly

1. Em **Grupos Dobra**, abrir um deputado → um grupo.  
2. Garantir que o grupo tem **link de convite** do WhatsApp.  
3. Gerar / sincronizar o **Bitly de convite** (link curto para *entrar* no grupo).  
4. Testar o link: deve levar ao convite do WhatsApp.  
5. (Opcional) Sincronizar cliques e ver se o número sobe.

**Checklist**

- [ ] Grupo aparece sob o deputado certo  
- [ ] Foto / membros / município ok  
- [ ] Bitly de convite abre o WhatsApp certo  

---

### Etapa D — Vídeo × um Bitly por grupo

Esta é a jornada central de distribuição de conteúdo:

1. Postar (ou ter) a URL do vídeo (YouTube, Instagram, etc.).  
2. Ir na aba **Bitly**.  
3. **Novo vídeo** → colar a URL / título.  
4. **Gerar Bitly para os grupos** → o sistema cria **1 link por grupo**  
   (ex.: 150 grupos = 150 links).  
5. Copiar o link de cada grupo e mandar **só naquele grupo**.  
6. Depois, **Sincronizar cliques** para ver quem abriu.

**Dois tipos de Bitly (não misturar):**

| Tipo | Serve para |
|------|------------|
| **Convite do grupo** | Pessoa **entrar** no WhatsApp |
| **Link do vídeo** | Pessoa **abrir o conteúdo**; medição por grupo |

**Checklist**

- [ ] Vídeo criado na aba Bitly  
- [ ] Quantidade de links ≈ quantidade de grupos  
- [ ] Link do grupo A não é o mesmo do grupo B  
- [ ] Sync de cliques atualiza números  

---

### Etapa E — Coordenadores e Instagram (se usar)

1. Aba **Coordenadores**: ver desempenho por pessoa/cidade.  
2. Conferir metas (voto / conteúdo).  
3. Se Instagram estiver conectado: sincronizar.  
4. Se aparecer **token expirado**: anotar números na mão e pedir renovação técnica — a tela deve avisar com clareza.

**Checklist**

- [ ] Coordenador aparece com municípios certos  
- [ ] Alarmes fazem sentido (ou estão vazios)  
- [ ] Status do Instagram é verdadeiro (ativo vs expirado)  

---

### Etapa F — Relatório do dia a dia (ocorrências)

1. Aba **Relatório** → **O que aconteceu nas cidades**.  
2. Coordenador → cidade → **Novo registro**.  
3. Escrever o que aconteceu, data, prints do WhatsApp.  
4. Marcar **Resolvido** ou manter **Em aberto**.  

Isso é o “caderno de bordo” territorial — não é o mesmo que o dossiê de investimento.

---

### Etapa G — Panorama para reunião

1. Relatório → **Panorama da campanha**.  
2. Ver números gerais e alertas.  
3. **Gerar texto para reunião** (resumo para falar com a equipe).  
4. **Imprimir / PDF** se for levar para reunião presencial.

---

### Etapa H — Investimento (dossiê municipal)

1. Aba **Investimento**.  
2. Escolher município.  
3. Enviar Word (.docx), colar texto, ou carregar base oficial.  
4. Ver dossiê organizado por categorias (Infraestrutura, Saúde, Educação etc.).  
5. Gerar PDF para apresentar na cidade.

---

### Etapa I — Conteúdo da semana

1. Aba **Conteúdo**.  
2. Criar post da semana.  
3. Atribuir quem deve dobrar em quais cidades.  
4. Acompanhar; opcionalmente sync Meta / criar Bitly a partir do post.

---

### Etapa J — Missões e ranking (opcional)

1. Em Mobilização → **Missões**: criar metas.  
2. Avançar progresso (+5 / +10).  
3. Ver impacto no **Ranking** das lideranças.

---

## 6. Roteiro de teste rápido (30–40 min)

Use se a equipe só quer validar se “está vivo”:

1. Login ok.  
2. Criar 1 cadastro por link de mobilizador.  
3. Criar 1 evento + 1 inscrição via QR (URL pública).  
4. Criar/abrir 1 deputado + 1 grupo.  
5. Criar 1 vídeo Bitly e gerar links (mesmo que só para 1–2 grupos).  
6. Registrar 1 ocorrência em Relatório.  
7. Abrir Visão Geral e ver os números batendo.

Se algo falhar, anote **em qual etapa** (B, C, D…) — facilita o suporte.

---

## 7. O que cada número “quer dizer”

| Número | Significado simples |
|--------|---------------------|
| Cadastros | Pessoas na base |
| Presentes / inscritos de evento | Quem entrou pelo QR daquele evento |
| Coordenadores | Equipe Atlas responsável por região/dobra |
| Grupos | WhatsApps da dobra |
| Cliques Bitly (vídeo) | Quantas vezes abriram o link daquele vídeo naquele grupo |
| Cliques Bitly (convite) | Interesse em entrar no grupo |
| Em aberto / Resolvido (Relatório) | Problema ainda pendente vs já tratado |
| Meta de voto / progresso | Cadastros vs expectativa na cidade |
| Comentários IG | Atividade no Instagram do coordenador/cidade (quando sincroniza) |

---

## 8. Problemas comuns (sem jargão)

| Sintoma | O que costuma ser | O que fazer |
|---------|-------------------|-------------|
| QR não abre no celular | Link aponta para computador local | Usar o endereço do site **no ar** |
| Bitly não cria link | Falta configurar Bitly no servidor, ou grupo sem convite WhatsApp | Pedir à equipe técnica; completar convite do grupo |
| Instagram “não puxa” | Acesso expirado | Renovar token; enquanto isso, anotar na mão |
| Dados sumiram após atualizar o site | Banco temporário (sem banco permanente) | Equipe técnica: conferir banco Postgres no Render |
| Prints do Relatório sumiram | Storage de imagens não configurado | Texto continua; fotos precisam de Storage |
| Aba Mídia vazia | Ainda em construção | Ignorar por enquanto |
| Grupo no card “errado” | Hierarquia: grupo é do **deputado**, não do coord. de cidade | Conferir em Grupos Dobra o deputado estadual |

---

## 9. O que ainda não está pronto

- **Aba Mídia:** placeholder (“Em construção”).  
- **Instagram / Meta:** funciona melhor com token válido; sem isso, modo manual.  
- **Bitly:** depende de token no servidor.  
- Não há perfil de acesso “só leitura” ou “só campo” separado no painel.

---

## 10. Glossário rápido

| Palavra | Significado |
|---------|-------------|
| **Campanha** | O “projeto” no sistema (ex.: Fábio Garcia). |
| **Mobilização** | Trabalho de trazer e organizar pessoas. |
| **Liderança** | Pessoa política / multiplicadora com link próprio. |
| **Mobilizador** | Pessoa de campo com link próprio. |
| **Dobra** | Rede de apoio (deputados estaduais + grupos) que reforça a campanha. |
| **Bitly** | Link curto que conta cliques. |
| **Radar** | Tela ao vivo do evento. |
| **Dossiê / Investimento** | Histórico do que foi entregue no município. |
| **Demanda / registro** | Anotação do que aconteceu na cidade (Relatório). |
| **Sync** | “Atualizar agora” os números de fora (Bitly, Instagram). |

---

## 11. Resumo da jornada em uma linha do tempo

```
Admin (estrutura)
   → Grupos Dobra (deputados + WhatsApps)
   → Mobilização (links, eventos, QR, mapa, ranking)
   → Pessoas se cadastram (3 portas)
   → Bitly (vídeo → 1 link por grupo → sync cliques)
   → Coordenadores / Conteúdo (cobrar e acompanhar)
   → Relatório (anotar problemas + panorama de reunião)
   → Investimento (dossiê PDF por cidade)
```

Essa é a jornada que está programada hoje. Seguindo as etapas A → J (ou o roteiro rápido da seção 6), qualquer pessoa da equipe consegue **entender e testar** o sistema sem precisar saber programação.
