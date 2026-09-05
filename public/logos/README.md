# Como trocar as logos (arquivos originais)

Coloque **seus arquivos originais** nestas pastas (mesmos nomes):

## 1) Atlas Agency (logo + favicon = mesma imagem)

Salve a foto da estátua do Atlas como:

```
client/public/logos/atlas-agency.png
public/logos/atlas-agency.png
```

O favicon usa a **mesma imagem**. Depois de salvar, rode:

```bash
cp client/public/logos/atlas-agency.png client/public/favicon.png
cp client/public/logos/atlas-agency.png client/public/logos/atlas-agency-mark.png
cp client/public/logos/atlas-agency.png client/public/logos/atlas-agency-horizontal.png
cp public/logos/atlas-agency.png public/logos/atlas-agency-mark.png
cp public/logos/atlas-agency.png public/logos/atlas-agency-horizontal.png
```

Ou simplesmente:

```bash
npm run logos:sync
```

## 2) Fábio Garcia (logo da campanha)

Salve a logo amarelo/azul como:

```
client/public/logos/fabio-garcia.png
public/logos/fabio-garcia.png
```

## Formatos aceitos

- Preferência: `.png` com fundo transparente ou branco
- Também funciona: `.jpg` / `.webp` (renomeie para `.png` ou avise para eu ajustar)

## Forma mais fácil comigo (Cloud Agent)

1. Anexe de novo as **duas imagens originais** aqui no chat (como arquivo/anexo)
2. Escreva: “usa essas logos”
3. Eu copio para os caminhos certos, atualizo favicon e faço commit/push

## Via GitHub

Suba os arquivos em:
`client/public/logos/atlas-agency.png` e `client/public/logos/fabio-garcia.png`
na branch `cursor/atlas-agency-platform-b8e1`.
