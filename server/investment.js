/**
 * Dossiê regional de investimentos (emendas / viabilizações) por município.
 * Manual — sem Meta/Instagram. Foco: MT, card por município, categorias accordion.
 */

const CATEGORIES = [
  { id: 'infraestrutura', label: 'Infraestrutura', color: '#2F5233', tag: 'infra' },
  { id: 'saude', label: 'Saúde', color: '#8C3B2E', tag: 'saude' },
  { id: 'agricultura', label: 'Agricultura', color: '#A9781F', tag: 'agro' },
  { id: 'educacao', label: 'Educação', color: '#4A5F8C', tag: 'educacao' },
  { id: 'regularizacao', label: 'Regularização Fundiária', color: '#345670', tag: 'fundiaria' },
  { id: 'outros', label: 'Outros', color: '#5a5a5a', tag: 'outros' },
];

const TAG_TO_CATEGORY = {
  infra: 'infraestrutura',
  infraestrutura: 'infraestrutura',
  'infraestrutura / social': 'infraestrutura',
  'infraestrutura social': 'infraestrutura',
  social: 'infraestrutura',
  saude: 'saude',
  saúde: 'saude',
  agro: 'agricultura',
  agricultura: 'agricultura',
  'agricultura / maquinarios': 'agricultura',
  'agricultura / maquinários': 'agricultura',
  maquinarios: 'agricultura',
  maquinários: 'agricultura',
  educacao: 'educacao',
  educação: 'educacao',
  fundiaria: 'regularizacao',
  regularizacao: 'regularizacao',
  'regularização': 'regularizacao',
  'regularização fundiária': 'regularizacao',
  outros: 'outros',
};

const AMOUNT_UNKNOWN = '__amount_unknown__';

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function enrichRow(row) {
  const meta = categoryMeta(row.category);
  const unknown = row.notes === AMOUNT_UNKNOWN || row.amount_unknown;
  return {
    ...row,
    amount: unknown ? null : money(row.amount),
    amount_unknown: Boolean(unknown),
    category_label: meta.label,
    category_color: meta.color,
    notes: unknown ? null : row.notes,
  };
}

function listInvestments(db, campaignId, { municipalityId, category } = {}) {
  let sql = `
    SELECT i.*,
      m.name AS municipality_name
    FROM campaign_investments i
    LEFT JOIN municipalities m ON m.id = i.municipality_id
    WHERE i.campaign_id = ?
  `;
  const params = [campaignId];
  if (municipalityId) {
    sql += ' AND i.municipality_id = ?';
    params.push(Number(municipalityId));
  }
  if (category) {
    sql += ' AND i.category = ?';
    params.push(String(category));
  }
  sql += ' ORDER BY m.name ASC, i.sort_order ASC, i.id ASC';
  return db.prepare(sql).all(...params).map(enrichRow);
}

function listMunicipalityNotes(db, campaignId) {
  try {
    return db.prepare(`
      SELECT * FROM campaign_investment_muni_notes WHERE campaign_id = ?
    `).all(campaignId);
  } catch {
    return [];
  }
}

function upsertMunicipalityNote(db, campaignId, municipalityId, footnote, sortOrder) {
  const existing = db.prepare(`
    SELECT id FROM campaign_investment_muni_notes
    WHERE campaign_id = ? AND municipality_id = ?
  `).get(campaignId, municipalityId);
  if (existing) {
    db.prepare(`
      UPDATE campaign_investment_muni_notes SET
        footnote = ?,
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      footnote ? String(footnote).trim() : null,
      sortOrder != null ? Number(sortOrder) : null,
      existing.id,
    );
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO campaign_investment_muni_notes (campaign_id, municipality_id, footnote, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(
    campaignId,
    municipalityId,
    footnote ? String(footnote).trim() : null,
    sortOrder != null ? Number(sortOrder) : 0,
  );
  return result.lastInsertRowid;
}

/**
 * Monta o dossiê: municípios com totais e categorias colapsáveis.
 * Opção: filtrar por coordinator_id (municípios já vinculados ao coordenador no Atlas).
 */
function buildDossier(db, campaignId, { coordinatorId } = {}) {
  const items = listInvestments(db, campaignId);
  const notes = listMunicipalityNotes(db, campaignId);
  const noteByMuni = new Map(notes.map((n) => [n.municipality_id, n]));

  // Vínculo município ↔ coordenador já cadastrado na campanha
  const coordLinks = db.prepare(`
    SELECT cm.municipality_id,
      c.id AS coordinator_id,
      c.name AS coordinator_name
    FROM coordinator_municipalities cm
    JOIN coordinators c ON c.id = cm.coordinator_id
    WHERE c.campaign_id = ?
    ORDER BY c.name ASC
  `).all(campaignId);

  const coordsByMuni = new Map();
  for (const row of coordLinks) {
    if (!coordsByMuni.has(row.municipality_id)) coordsByMuni.set(row.municipality_id, []);
    coordsByMuni.get(row.municipality_id).push({
      id: row.coordinator_id,
      name: row.coordinator_name,
    });
  }

  const byMuni = new Map();
  for (const item of items) {
    if (!item.municipality_id) continue;
    if (!byMuni.has(item.municipality_id)) {
      const note = noteByMuni.get(item.municipality_id);
      const coordinators = coordsByMuni.get(item.municipality_id) || [];
      byMuni.set(item.municipality_id, {
        municipality_id: item.municipality_id,
        municipality_name: item.municipality_name || 'Município',
        sort_order: note?.sort_order ?? 9999,
        footnote: note?.footnote || null,
        coordinators,
        coordinator_id: coordinators[0]?.id || null,
        coordinator_name: coordinators[0]?.name || null,
        total: 0,
        count: 0,
        categories: {},
      });
    }
    const muni = byMuni.get(item.municipality_id);
    muni.total = money(muni.total + (item.amount_unknown ? 0 : money(item.amount)));
    muni.count += 1;

    const catId = item.category || 'outros';
    if (!muni.categories[catId]) {
      const meta = categoryMeta(catId);
      muni.categories[catId] = {
        category: catId,
        category_label: meta.label,
        category_color: meta.color,
        total: 0,
        count: 0,
        items: [],
      };
    }
    const cat = muni.categories[catId];
    cat.total = money(cat.total + (item.amount_unknown ? 0 : money(item.amount)));
    cat.count += 1;
    cat.items.push({
      id: item.id,
      description: item.description,
      amount: item.amount,
      amount_unknown: Boolean(item.amount_unknown),
      receipt_ref: item.receipt_ref,
      notes: item.notes,
      sort_order: item.sort_order,
    });
  }

  const catOrder = CATEGORIES.map((c) => c.id);

  let municipalities = [...byMuni.values()].map((m) => ({
    ...m,
    categories: catOrder
      .filter((id) => m.categories[id])
      .map((id) => m.categories[id])
      .concat(
        Object.keys(m.categories)
          .filter((id) => !catOrder.includes(id))
          .map((id) => m.categories[id]),
      ),
  }));

  // Índice de coordenadores (para o seletor) — todos da campanha com totais do dossiê
  const allCoords = db.prepare(`
    SELECT id, name FROM coordinators WHERE campaign_id = ? ORDER BY name ASC
  `).all(campaignId);

  const coordinatorsIndex = allCoords.map((c) => {
    const muniIds = new Set(
      coordLinks.filter((l) => l.coordinator_id === c.id).map((l) => l.municipality_id),
    );
    const dossierMunis = municipalities.filter((m) => muniIds.has(m.municipality_id));
    return {
      id: c.id,
      name: c.name,
      municipalities_assigned: muniIds.size,
      dossier_municipality_count: dossierMunis.length,
      dossier_item_count: dossierMunis.reduce((s, m) => s + m.count, 0),
      dossier_total: money(dossierMunis.reduce((s, m) => s + m.total, 0)),
    };
  });

  let filterCoordinator = null;
  if (coordinatorId) {
    const cid = Number(coordinatorId);
    filterCoordinator = coordinatorsIndex.find((c) => c.id === cid) || null;
    municipalities = municipalities.filter((m) =>
      (m.coordinators || []).some((c) => c.id === cid),
    );
  }

  municipalities.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return String(a.municipality_name).localeCompare(String(b.municipality_name), 'pt-BR');
  });

  municipalities = municipalities.map((m, idx) => ({
    ...m,
    index: idx + 1,
  }));

  const grand_total = money(municipalities.reduce((s, m) => s + m.total, 0));
  const item_count = municipalities.reduce((s, m) => s + m.count, 0);

  return {
    title: filterCoordinator
      ? `Investimentos · ${filterCoordinator.name}`
      : 'Investimentos por Município',
    eyebrow: filterCoordinator
      ? `Dossiê do coordenador · ${filterCoordinator.name}`
      : 'Dossiê regional · Estado de Mato Grosso',
    subtitle: filterCoordinator
      ? `Municípios vinculados a ${filterCoordinator.name} no Atlas, com o total viabilizado e a lista item a item.`
      : 'Levantamento organizado por município, com o total viabilizado e a relação item a item de cada categoria de investimento (infraestrutura, saúde, agricultura e regularização fundiária).',
    municipality_count: municipalities.length,
    item_count,
    grand_total,
    municipalities,
    categories: CATEGORIES,
    items: coordinatorId
      ? items.filter((it) => municipalities.some((m) => m.municipality_id === it.municipality_id))
      : items,
    coordinators: coordinatorsIndex,
    filter_coordinator: filterCoordinator,
  };
}

function getInvestment(db, campaignId, id) {
  const row = db.prepare(`
    SELECT i.*, m.name AS municipality_name
    FROM campaign_investments i
    LEFT JOIN municipalities m ON m.id = i.municipality_id
    WHERE i.id = ? AND i.campaign_id = ?
  `).get(id, campaignId);
  return row ? enrichRow(row) : null;
}

function createInvestment(db, campaignId, body) {
  const amount = money(body.amount);
  if (!(amount > 0)) {
    const err = new Error('Informe um valor maior que zero');
    err.status = 400;
    throw err;
  }
  const municipalityId = Number(body.municipality_id);
  if (!municipalityId) {
    const err = new Error('Município é obrigatório');
    err.status = 400;
    throw err;
  }
  const description = String(body.description || '').trim();
  if (!description) {
    const err = new Error('Descrição do item é obrigatória');
    err.status = 400;
    throw err;
  }
  const category = String(body.category || 'infraestrutura').trim() || 'infraestrutura';

  const result = db.prepare(`
    INSERT INTO campaign_investments (
      campaign_id, coordinator_id, municipality_id, category, description,
      amount, invested_at, receipt_ref, notes, created_by, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    body.coordinator_id ? Number(body.coordinator_id) : null,
    municipalityId,
    category,
    description,
    amount,
    body.invested_at ? String(body.invested_at).slice(0, 10) : null,
    body.receipt_ref ? String(body.receipt_ref).trim() : null,
    body.notes ? String(body.notes).trim() : null,
    body.created_by ? String(body.created_by).trim() : null,
    body.sort_order != null ? Number(body.sort_order) : 0,
  );

  return getInvestment(db, campaignId, result.lastInsertRowid);
}

function updateInvestment(db, campaignId, id, body) {
  const existing = getInvestment(db, campaignId, id);
  if (!existing) return null;

  const amount = body.amount !== undefined ? money(body.amount) : existing.amount;
  if (!(amount > 0)) {
    const err = new Error('Informe um valor maior que zero');
    err.status = 400;
    throw err;
  }
  const description = body.description !== undefined
    ? String(body.description || '').trim()
    : existing.description;
  if (!description) {
    const err = new Error('Descrição do item é obrigatória');
    err.status = 400;
    throw err;
  }
  const municipalityId = body.municipality_id !== undefined
    ? Number(body.municipality_id)
    : existing.municipality_id;
  if (!municipalityId) {
    const err = new Error('Município é obrigatório');
    err.status = 400;
    throw err;
  }

  db.prepare(`
    UPDATE campaign_investments SET
      coordinator_id = ?,
      municipality_id = ?,
      category = ?,
      description = ?,
      amount = ?,
      invested_at = ?,
      receipt_ref = ?,
      notes = ?,
      sort_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND campaign_id = ?
  `).run(
    body.coordinator_id !== undefined
      ? (body.coordinator_id ? Number(body.coordinator_id) : null)
      : existing.coordinator_id,
    municipalityId,
    body.category !== undefined ? String(body.category || 'infraestrutura') : existing.category,
    description,
    amount,
    body.invested_at !== undefined
      ? (body.invested_at ? String(body.invested_at).slice(0, 10) : null)
      : existing.invested_at,
    body.receipt_ref !== undefined
      ? (body.receipt_ref ? String(body.receipt_ref).trim() : null)
      : existing.receipt_ref,
    body.notes !== undefined
      ? (body.notes ? String(body.notes).trim() : null)
      : existing.notes,
    body.sort_order !== undefined ? Number(body.sort_order) || 0 : (existing.sort_order || 0),
    id,
    campaignId,
  );

  return getInvestment(db, campaignId, id);
}

function deleteInvestment(db, campaignId, id) {
  const existing = getInvestment(db, campaignId, id);
  if (!existing) return false;
  db.prepare('DELETE FROM campaign_investments WHERE id = ? AND campaign_id = ?').run(id, campaignId);
  return true;
}

/** Compat: summary antigo apontando para o dossiê */
function buildSummary(items) {
  return {
    total: money(items.reduce((s, r) => s + (r.amount_unknown ? 0 : money(r.amount)), 0)),
    count: items.length,
  };
}

function resolveCategory(tagOrId, label) {
  const raw = String(tagOrId || label || 'outros').trim().toLowerCase();
  if (TAG_TO_CATEGORY[raw]) return TAG_TO_CATEGORY[raw];
  const byLabel = CATEGORIES.find((c) => c.label.toLowerCase() === raw);
  if (byLabel) return byLabel.id;

  // Word criativo: "AGRICULTURA / MAQUINÁRIOS", "INFRAESTRUTURA / SOCIAL"
  const norm = stripAccents(raw).replace(/\s+/g, ' ');
  if (TAG_TO_CATEGORY[norm]) return TAG_TO_CATEGORY[norm];
  if (/educacao/.test(norm)) return 'educacao';
  if (/saude/.test(norm)) return 'saude';
  if (/agro|agricultura|maquin/.test(norm)) return 'agricultura';
  if (/fundiar|regulariz/.test(norm)) return 'regularizacao';
  if (/infra|social|paviment|ponte/.test(norm) && !/educacao/.test(norm)) return 'infraestrutura';
  return 'outros';
}

/** "O FEDERAL QUE MAIS INVESTIU EM ALTO TAQUARI" → Alto Taquari */
function extractMunicipalityFromCriativoTitle(text) {
  const m = String(text || '').match(
    /(?:o\s+)?federal\s+que\s+mais\s+investiu\s+em\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s'.-]+?)(?:\s*$|\s{2,}|\n)/i,
  ) || String(text || '').match(
    /investiu\s+em\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s'.-]{2,60})/i,
  );
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim().replace(/[.•]+$/, '');
}

function isNoiseCriativoLine(line) {
  const s = line.trim();
  if (!s) return true;
  if (/^área\s*\/\s*valor$/i.test(s)) return true;
  if (/^entregas?\s+para\s+o\s+criativo$/i.test(s)) return true;
  if (/^em\s+investimentos?$/i.test(s)) return true;
  if (/^rodap[eé]/i.test(s)) return true;
  if (/f[aá]bio\s+garcia/i.test(s) && /deputado/i.test(s)) return true;
  if (/^\d{1,2}\s*\/\s*\d{1,2}$/.test(s)) return true; // "1 / 14"
  if (/^o\s+federal\s+que\s+mais\s+investiu/i.test(s)) return true;
  return false;
}

function isCategoryHeading(line) {
  const clean = line
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .replace(/\s+[—–-]\s*R\$.*$/i, '')
    .trim();
  if (!clean || clean.length > 80) return false;
  // "AGRICULTURA / MAQUINÁRIOS" ou "SAÚDE" ou "EDUCAÇÃO"
  const norm = stripAccents(clean);
  if (isCategoryLine(clean)) return true;
  if (/^(infraestrutura|saude|agricultura|educacao|regularizacao)(\s*\/\s*[\w\s]+)?$/i.test(norm)) {
    return true;
  }
  // Área total colada: "AGRICULTURA / MAQUINÁRIOS R$ 571.800,00"
  if (/^(infraestrutura|saude|agricultura|educacao|regularizacao)/i.test(norm) && /r\$/i.test(clean)) {
    return true;
  }
  return false;
}

function categoryHeadingLabel(line) {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\s*[—–-]\s*R\$\s*[\d.,]+.*$/i, '')
    .replace(/\s+R\$\s*[\d.,]+.*$/i, '')
    .replace(/:$/, '')
    .trim();
}

/**
 * Aceita texto simples (recomendado), JSON, array JS ou HTML com script.
 */
function parseDossierPaste(raw) {
  let text = String(raw || '').trim();
  if (!text) {
    const err = new Error('Cole o texto do dossiê (município, categoria, itens e valores)');
    err.status = 400;
    throw err;
  }

  // HTML / script com const municipios = [...]
  const scriptMatch = text.match(/const\s+municipios\s*=\s*(\[[\s\S]*?\]);\s*(?:function|const|let|var|<\/script>)/i)
    || text.match(/(?:const\s+|let\s+|var\s+)?municipios\s*=\s*(\[[\s\S]*\])/i);
  if (scriptMatch) {
    text = scriptMatch[1];
  }

  // JSON
  try {
    const asJson = JSON.parse(text);
    if (Array.isArray(asJson)) return normalizeMunicipiosInput(asJson);
    if (Array.isArray(asJson?.municipios)) return normalizeMunicipiosInput(asJson.municipios);
  } catch {
    /* segue */
  }

  // Literal JS (se ainda parecer código)
  if (/^\s*\[/.test(text) || /^\s*\{/.test(text)) {
    try {
      // eslint-disable-next-line no-new-func
      const evaluated = Function(`"use strict"; return (${text});`)();
      if (Array.isArray(evaluated)) return normalizeMunicipiosInput(evaluated);
      if (Array.isArray(evaluated?.municipios)) return normalizeMunicipiosInput(evaluated.municipios);
    } catch {
      /* tenta texto simples */
    }
  }

  // Texto simples (o caminho normal da equipe)
  const plain = parsePlainTextDossier(String(raw || '').trim());
  if (plain.length) return plain;

  const err = new Error(
    'Não entendi o texto. Use o formato: nome do município, depois a categoria (Infraestrutura, Saúde…), e cada item com o valor em R$.',
  );
  err.status = 400;
  throw err;
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseMoneyToken(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || /não\s*informado|n\/?a|null|sem\s*valor/i.test(s)) return null;
  s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (!s) return null;
  // 1.030.556,00 ou 1030556.00 ou 1030556
  if (s.includes(',')) {
    return money(s.replace(/\./g, '').replace(',', '.'));
  }
  return money(s);
}

/** Resolve município por nome (exato, sem acento, ou contém). */
function findMunicipalityByName(db, nome) {
  const raw = String(nome || '').trim();
  if (!raw) return null;
  const exact = db.prepare('SELECT id, name FROM municipalities WHERE LOWER(name) = LOWER(?)').get(raw);
  if (exact) return exact;

  const target = stripAccents(raw);
  const all = db.prepare('SELECT id, name FROM municipalities').all();
  const byNorm = all.find((m) => stripAccents(m.name) === target);
  if (byNorm) return byNorm;

  // Contém / contido (ex.: "Araguaia" vs "Alto Araguaia") — só se único
  const partial = all.filter((m) => {
    const n = stripAccents(m.name);
    return n.includes(target) || target.includes(n);
  });
  if (partial.length === 1) return partial[0];
  return null;
}

function isCategoryLine(line) {
  const clean = line
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .replace(/\s+R\$\s*[\d.,]+.*$/i, '')
    .trim()
    .toLowerCase();
  if (!clean) return false;
  if (TAG_TO_CATEGORY[clean]) return true;
  if (CATEGORIES.some((c) => c.label.toLowerCase() === clean)) return true;
  const norm = stripAccents(clean);
  if (TAG_TO_CATEGORY[norm]) return true;
  return /^(infraestrutura|saude|agricultura|educacao|regularizacao)(\s*\/\s*.+)?$/i.test(norm);
}

/**
 * Layout do Word do criativo:
 * "O FEDERAL QUE MAIS INVESTIU EM ALTO TAQUARI"
 * ÁREA / VALOR | ENTREGAS PARA O CRIATIVO
 * AGRICULTURA / MAQUINÁRIOS + bullets com R$
 */
function parsePlainTextDossier(text) {
  const rawLines = String(text || '').split(/\r?\n/).map((l) => l.trim());
  const lines = rawLines.filter((l) => l && !/^---+/.test(l));
  if (!lines.length) return [];

  const municipios = [];
  let current = null;
  let currentGroup = null;
  let productionNotes = [];

  function ensureMuni(nome) {
    const clean = String(nome || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    // Evita recriar o mesmo município se o título repetir
    if (current && stripAccents(current.nome) === stripAccents(clean)) return;
    current = {
      nome: clean,
      nota: null,
      grupos: [],
    };
    municipios.push(current);
    currentGroup = null;
  }

  function ensureGroup(labelOrTag) {
    if (!current) return;
    const category = resolveCategory(labelOrTag, labelOrTag);
    const meta = categoryMeta(category);
    // Reusa grupo se a mesma categoria voltar (ex.: dois blocos INFRA)
    const existing = current.grupos.find((g) => resolveCategory(g.tag, g.label) === category);
    if (existing) {
      currentGroup = existing;
      return;
    }
    currentGroup = {
      tag: meta.tag || category,
      label: meta.label,
      itens: [],
    };
    current.grupos.push(currentGroup);
  }

  // Município no título do criativo
  const fromTitle = extractMunicipalityFromCriativoTitle(lines.join('\n'));
  if (fromTitle) ensureMuni(fromTitle);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (isNoiseCriativoLine(line)) continue;

    // Nota de produção / observação → rodapé do card
    if (/^nota\s+de\s+produ/i.test(line) || /^nota\s*:/i.test(line) || /^\*/.test(line) || /^observ/i.test(line)) {
      let note = line
        .replace(/^\*\s*/, '')
        .replace(/^nota\s+de\s+produ[cç][aã]o\s*:?\s*/i, '')
        .replace(/^nota\s*:\s*/i, '')
        .trim();
      // Junta linhas seguintes da nota até próxima categoria/item forte
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (isNoiseCriativoLine(next) || isCategoryHeading(next) || /R\$\s*[\d.,]+/.test(next)) break;
        if (/^rodap/i.test(next) || /^o\s+federal/i.test(next)) break;
        note = `${note} ${next}`.trim();
        i += 1;
      }
      if (note) productionNotes.push(note);
      if (current) current.nota = productionNotes.join(' ');
      continue;
    }

    // Município: Nome  |  # Nome  |  MUNICÍPIO Nome
    const muniHeader = line.match(/^(?:munic[ií]pio\s*[:\-–]?\s*|#\s*)(.+)$/i);
    if (muniHeader) {
      ensureMuni(muniHeader[1].trim());
      continue;
    }

    // Título criativo no meio do texto
    const titleMuni = extractMunicipalityFromCriativoTitle(line);
    if (titleMuni) {
      ensureMuni(titleMuni);
      continue;
    }

    // Categoria (ÁREA): "EDUCAÇÃO", "AGRICULTURA / MAQUINÁRIOS", opcionalmente com total
    if (isCategoryHeading(line)) {
      if (!current && fromTitle) ensureMuni(fromTitle);
      if (!current) continue;
      ensureGroup(categoryHeadingLabel(line));
      continue;
    }

    // Só valor na linha (total da área à esquerda — ignora se não há item pendente)
    if (/^(?:R\$\s*)?[\d.,]+\s*$/i.test(line) || /^não\s*informado$/i.test(line)) {
      if (current && currentGroup && currentGroup.itens.length) {
        const last = currentGroup.itens[currentGroup.itens.length - 1];
        if (last.v == null) last.v = parseMoneyToken(line);
      }
      // Totais de área / hero total sozinhos: ignorar
      continue;
    }

    // Item com valor: "Descrição — R$ 1.000,00" | "Descrição - R$ …"
    const itemMatch = line.match(
      /^(?:[-•*◦]\s*)?(.+?)\s*(?:—+|–+|-+|\||\t)\s*(R\$\s*[\d.,]+|[\d.,]+|não\s*informado)\s*$/i,
    ) || line.match(
      /^(?:[-•*◦]\s*)?(.+?)\s+(R\$\s*[\d.,]+)\s*$/i,
    );

    if (itemMatch) {
      if (!current) {
        if (fromTitle) ensureMuni(fromTitle);
        else continue;
      }
      if (!currentGroup) ensureGroup('infraestrutura');
      let desc = itemMatch[1].trim().replace(/^[-•*◦]\s*/, '');
      // Evita cadastrar o total da área como item (descrição = nome da categoria)
      if (isCategoryHeading(desc) || isCategoryLine(desc)) continue;
      if (/^(área|entregas?|total|em investimentos?)$/i.test(desc)) continue;
      const val = parseMoneyToken(itemMatch[2]);
      if (!desc) continue;
      currentGroup.itens.push({ d: desc, v: val });
      continue;
    }

    // Linha de item sem valor ainda (bullet) — valor pode vir na próxima
    if (/^[-•*◦]\s+.+/.test(line) && current) {
      if (!currentGroup) ensureGroup('infraestrutura');
      const desc = line.replace(/^[-•*◦]\s+/, '').trim();
      if (!isCategoryHeading(desc)) {
        currentGroup.itens.push({ d: desc, v: null });
      }
      continue;
    }

    // Linha curta sem valor → provavelmente nome de município (ex.: Alto Araguaia)
    const looksLikeCode = /[{}\[\]=;]|const\s|function\s|tag:|itens:/.test(line);
    if (
      !looksLikeCode
      && line.length <= 60
      && !/\d{3,}/.test(line)
      && !/^r\$/i.test(line)
      && !/investimentos?|criativo|rodap|federal|deputado/i.test(line)
    ) {
      if (!isCategoryHeading(line) && !isCategoryLine(line)) {
        ensureMuni(line);
      }
    }
  }

  if (productionNotes.length && municipios.length === 1 && !municipios[0].nota) {
    municipios[0].nota = productionNotes.join(' ');
  }

  return municipios.filter((m) => m.nome && m.grupos.some((g) => g.itens.length));
}

function normalizeMunicipiosInput(list) {
  return list.map((m, idx) => {
    const nome = String(m.nome || m.name || m.municipality || m.municipio || '').trim();
    const grupos = Array.isArray(m.grupos)
      ? m.grupos
      : Array.isArray(m.groups)
        ? m.groups
        : Array.isArray(m.categories)
          ? m.categories
          : [];

    // Formato flat antigo: { municipality, items:[{category,description,amount}] }
    if (!grupos.length && Array.isArray(m.items)) {
      const byCat = {};
      for (const it of m.items) {
        const cat = resolveCategory(it.category, it.category_label);
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push({
          d: it.description || it.d || '',
          v: it.amount != null ? it.amount : it.v,
        });
      }
      return {
        nome,
        nota: m.nota || m.footnote || null,
        sort_order: m.sort_order != null ? m.sort_order : idx + 1,
        grupos: Object.entries(byCat).map(([cat, itens]) => ({
          tag: CATEGORIES.find((c) => c.id === cat)?.tag || cat,
          label: categoryMeta(cat).label,
          itens,
        })),
      };
    }

    return {
      nome,
      nota: m.nota || m.footnote || null,
      sort_order: m.sort_order != null ? m.sort_order : idx + 1,
      grupos: grupos.map((g) => ({
        tag: g.tag || g.category || 'infra',
        label: g.label || categoryMeta(resolveCategory(g.tag, g.label)).label,
        itens: (g.itens || g.items || []).map((it) => ({
          d: it.d || it.description || '',
          v: it.v !== undefined ? it.v : it.amount,
        })),
      })),
    };
  }).filter((m) => m.nome);
}

/**
 * Importa o dossiê parseado.
 * @param {{ merge?: boolean }} options
 *   merge=false (padrão no texto/oficial): apaga o dossiê inteiro e recria
 *   merge=true (Word por município): só substitui os municípios enviados
 */
function importDossier(db, campaignId, municipiosInput, options = {}) {
  const merge = Boolean(options.merge);
  const municipios = Array.isArray(municipiosInput)
    ? normalizeMunicipiosInput(municipiosInput)
    : parseDossierPaste(municipiosInput);

  if (!municipios.length) {
    const err = new Error('Nenhum município encontrado no texto');
    err.status = 400;
    throw err;
  }

  const missing = [];
  const resolved = [];

  for (const block of municipios) {
    const muni = findMunicipalityByName(db, block.nome);
    if (!muni) {
      missing.push(block.nome);
      continue;
    }
    resolved.push({ ...block, municipality_id: muni.id, municipality_name: muni.name });
  }

  if (!resolved.length) {
    const err = new Error(
      `Nenhum município bateu com a base do Atlas. Confira os nomes (ex.: ${missing.slice(0, 3).join(', ')})`,
    );
    err.status = 400;
    err.missing = missing;
    throw err;
  }

  const insertItem = db.prepare(`
    INSERT INTO campaign_investments (
      campaign_id, coordinator_id, municipality_id, category, description, amount, notes, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const clearItems = db.prepare('DELETE FROM campaign_investments WHERE campaign_id = ?');
  const clearNotes = db.prepare('DELETE FROM campaign_investment_muni_notes WHERE campaign_id = ?');
  const insertNote = db.prepare(`
    INSERT INTO campaign_investment_muni_notes (campaign_id, municipality_id, footnote, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  const deleteNoteForMuni = db.prepare(`
    DELETE FROM campaign_investment_muni_notes WHERE campaign_id = ? AND municipality_id = ?
  `);

  // Coordenador principal já vinculado ao município no Atlas
  const coordForMuni = db.prepare(`
    SELECT c.id
    FROM coordinator_municipalities cm
    JOIN coordinators c ON c.id = cm.coordinator_id
    WHERE cm.municipality_id = ? AND c.campaign_id = ?
    ORDER BY c.name ASC
    LIMIT 1
  `);

  let inserted = 0;
  const run = () => {
    if (merge) {
      const ids = [...new Set(resolved.map((b) => b.municipality_id))];
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`
        DELETE FROM campaign_investments
        WHERE campaign_id = ? AND municipality_id IN (${placeholders})
      `).run(campaignId, ...ids);
      for (const id of ids) {
        deleteNoteForMuni.run(campaignId, id);
      }
    } else {
      clearItems.run(campaignId);
      clearNotes.run(campaignId);
    }

    for (const block of resolved) {
      if (block.nota || block.sort_order != null) {
        insertNote.run(campaignId, block.municipality_id, block.nota || null, block.sort_order || 0);
      }
      const linkedCoord = coordForMuni.get(block.municipality_id, campaignId);
      let order = 0;
      for (const g of block.grupos || []) {
        const category = resolveCategory(g.tag, g.label);
        for (const it of g.itens || []) {
          const desc = String(it.d || '').trim();
          if (!desc) continue;
          const unknown = it.v === null || it.v === undefined || it.v === '';
          const amount = unknown ? 0 : money(it.v);
          insertItem.run(
            campaignId,
            linkedCoord?.id || null,
            block.municipality_id,
            category,
            desc,
            amount,
            unknown ? AMOUNT_UNKNOWN : null,
            order,
          );
          order += 1;
          inserted += 1;
        }
      }
    }
  };

  if (typeof db.transaction === 'function') {
    db.transaction(run)();
  } else {
    run();
  }

  return {
    ok: true,
    merge,
    municipalities_imported: resolved.length,
    municipalities_missing: missing,
    municipalities: resolved.map((b) => b.municipality_name || b.nome),
    items_inserted: inserted,
    dossier: buildDossier(db, campaignId),
  };
}

function loadOfficialDossierSeed() {
  return require('./data/dossier-investments-seed');
}

/**
 * Zera o dossiê inteiro ou só os municípios de um coordenador.
 */
function clearDossier(db, campaignId, { coordinatorId } = {}) {
  let deletedItems = 0;
  let deletedNotes = 0;
  let municipalityIds = [];

  if (coordinatorId) {
    const cid = Number(coordinatorId);
    municipalityIds = db.prepare(`
      SELECT DISTINCT cm.municipality_id AS id
      FROM coordinator_municipalities cm
      JOIN coordinators c ON c.id = cm.coordinator_id
      WHERE c.campaign_id = ? AND c.id = ?
    `).all(campaignId, cid).map((r) => r.id);

    if (!municipalityIds.length) {
      return {
        ok: true,
        deleted_items: 0,
        deleted_notes: 0,
        municipalities_cleared: 0,
        dossier: buildDossier(db, campaignId),
        tip: 'Esse coordenador não tem municípios vinculados no Atlas.',
      };
    }

    const placeholders = municipalityIds.map(() => '?').join(',');
    const delItems = db.prepare(`
      DELETE FROM campaign_investments
      WHERE campaign_id = ? AND municipality_id IN (${placeholders})
    `).run(campaignId, ...municipalityIds);
    deletedItems = delItems.changes || 0;

    const delNotes = db.prepare(`
      DELETE FROM campaign_investment_muni_notes
      WHERE campaign_id = ? AND municipality_id IN (${placeholders})
    `).run(campaignId, ...municipalityIds);
    deletedNotes = delNotes.changes || 0;
  } else {
    deletedItems = db.prepare('DELETE FROM campaign_investments WHERE campaign_id = ?').run(campaignId).changes || 0;
    deletedNotes = db.prepare('DELETE FROM campaign_investment_muni_notes WHERE campaign_id = ?').run(campaignId).changes || 0;
  }

  return {
    ok: true,
    deleted_items: deletedItems,
    deleted_notes: deletedNotes,
    municipalities_cleared: coordinatorId ? municipalityIds.length : null,
    dossier: buildDossier(db, campaignId),
  };
}

module.exports = {
  CATEGORIES,
  categoryMeta,
  listInvestments,
  buildDossier,
  buildSummary,
  createInvestment,
  getInvestment,
  updateInvestment,
  deleteInvestment,
  upsertMunicipalityNote,
  listMunicipalityNotes,
  parseDossierPaste,
  parsePlainTextDossier,
  importDossier,
  clearDossier,
  loadOfficialDossierSeed,
  findMunicipalityByName,
  AMOUNT_UNKNOWN,
};
