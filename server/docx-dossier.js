/**
 * Extrai texto de arquivos Word (.docx) e monta blocos de município
 * para o importador do dossiê de investimentos.
 */

const mammoth = require('mammoth');

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Nome do arquivo → tentativa de município (ex.: "Alto Araguaia.docx") */
function municipalityHintFromFilename(filename) {
  let base = String(filename || '')
    .replace(/\.(docx|doc|odt|rtf)$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
  // Remove prefixos tipo "01 - ", "Valmir - "
  base = base.replace(/^\d{1,3}\s*[-–.)]\s*/, '');
  base = base.replace(/^(dossie|dossier|investimento|investimentos|municipio|município)\s*[-–:]?\s*/i, '');
  base = base.replace(/\s*[-–]\s*(valmir|coordenador|coord\.?).*$/i, '');
  return base.trim();
}

/**
 * Mammoth devolve texto com \n; tabelas viram linhas. Normalizamos um pouco
 * para o parsePlainTextDossier entender melhor.
 */
function normalizeExtractedText(raw, filenameHint) {
  let text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t+/g, ' — ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  // Se o doc não declara o município e o arquivo tem o nome, injeta no topo
  const hasMuniHeader = /(?:^|\n)\s*(?:munic[ií]pio\s*[:\-–]?\s*|#\s*)/i.test(text)
    || (filenameHint && new RegExp(`^\\s*${escapeRegExp(filenameHint)}\\s*$`, 'im').test(text.split('\n')[0] || ''));

  if (filenameHint && !hasMuniHeader) {
    const firstLine = (text.split('\n')[0] || '').trim();
    const firstLooksLikeMuni = firstLine.length <= 60
      && !/infraestrutura|saúde|saude|agricultura|regulariza|r\$/i.test(firstLine)
      && stripAccents(firstLine) === stripAccents(filenameHint);
    if (!firstLooksLikeMuni) {
      text = `Município: ${filenameHint}\n\n${text}`;
    }
  }

  // "Descrição R$ 1.000,00" em linha única (comum em Word) — já coberto pelo parser
  // Quebra "Categoria:" colada
  text = text.replace(/\b(Infraestrutura|Saúde|Saude|Agricultura|Regularização Fundiária|Regularizacao Fundiaria)\s*:/gi, '\n$1\n');

  return text.trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {{ name: string, buffer: Buffer }[]} files
 * @param {{ parsePlainText: Function }} deps
 * @returns {Promise<{ municipios: object[], files: object[] }>}
 */
async function parseDocxFiles(files, { parsePlainText }) {
  if (!Array.isArray(files) || !files.length) {
    const err = new Error('Envie pelo menos um arquivo .docx');
    err.status = 400;
    throw err;
  }

  const fileResults = [];
  const allMunicipios = [];

  for (const file of files) {
    const name = file.name || file.filename || 'arquivo.docx';
    if (!/\.docx$/i.test(name)) {
      fileResults.push({
        name,
        ok: false,
        error: 'Só aceitamos .docx (Word moderno). Salve de novo como .docx se estiver em .doc.',
      });
      continue;
    }

    const buffer = file.buffer || (file.content_base64
      ? Buffer.from(String(file.content_base64).replace(/^data:[^;]+;base64,/, ''), 'base64')
      : null);

    if (!buffer || !buffer.length) {
      fileResults.push({ name, ok: false, error: 'Arquivo vazio' });
      continue;
    }

    try {
      const result = await mammoth.extractRawText({ buffer });
      const hint = municipalityHintFromFilename(name);
      const text = normalizeExtractedText(result.value, hint);
      if (!text) {
        fileResults.push({ name, ok: false, error: 'Não achei texto nesse Word' });
        continue;
      }

      let parsed = parsePlainText(text);
      // Se o parser não achou município mas o nome do arquivo sugere um, força
      if (!parsed.length && hint) {
        parsed = parsePlainText(`Município: ${hint}\n\n${text}`);
      }

      // Se ainda veio 1 bloco sem nome útil, usa o hint
      if (parsed.length === 1 && hint && (!parsed[0].nome || stripAccents(parsed[0].nome) === 'municipio')) {
        parsed[0].nome = hint;
      }

      if (!parsed.length) {
        fileResults.push({
          name,
          ok: false,
          error: 'Não entendi o conteúdo. Use categorias (Infraestrutura, Saúde…) e itens com R$.',
          preview: text.slice(0, 280),
        });
        continue;
      }

      // Preferência: se o doc tem um município e o arquivo nomeia outro, prioriza o texto;
      // se o texto não bate e o hint existe, anota.
      for (const m of parsed) {
        if (!m.nome && hint) m.nome = hint;
        allMunicipios.push(m);
      }

      fileResults.push({
        name,
        ok: true,
        municipality_hint: hint || null,
        municipalities: parsed.map((m) => m.nome),
        item_count: parsed.reduce((n, m) => n + m.grupos.reduce((a, g) => a + g.itens.length, 0), 0),
      });
    } catch (err) {
      fileResults.push({
        name,
        ok: false,
        error: err.message || 'Falha ao ler o Word',
      });
    }
  }

  return { municipios: allMunicipios, files: fileResults };
}

module.exports = {
  parseDocxFiles,
  municipalityHintFromFilename,
  normalizeExtractedText,
  stripAccents,
};
