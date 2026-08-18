/**
 * Dossiê regional de investimentos (emendas / viabilizações) por município.
 * Manual — sem Meta/Instagram. Foco: MT, card por município, categorias accordion.
 */

const CATEGORIES = [
  { id: 'infraestrutura', label: 'Infraestrutura', color: '#2F5233', tag: 'infra' },
  { id: 'saude', label: 'Saúde', color: '#8C3B2E', tag: 'saude' },
  { id: 'agricultura', label: 'Agricultura', color: '#A9781F', tag: 'agro' },
  { id: 'regularizacao', label: 'Regularização Fundiária', color: '#345670', tag: 'fundiaria' },
  { id: 'outros', label: 'Outros', color: '#5a5a5a', tag: 'outros' },
];

const TAG_TO_CATEGORY = {
  infra: 'infraestrutura',
  infraestrutura: 'infraestrutura',
  saude: 'saude',
  saúde: 'saude',
  agro: 'agricultura',
  agricultura: 'agricultura',
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
 */
function buildDossier(db, campaignId) {
  const items = listInvestments(db, campaignId);
  const notes = listMunicipalityNotes(db, campaignId);
  const noteByMuni = new Map(notes.map((n) => [n.municipality_id, n]));

  const byMuni = new Map();
  for (const item of items) {
    if (!item.municipality_id) continue;
    if (!byMuni.has(item.municipality_id)) {
      const note = noteByMuni.get(item.municipality_id);
      byMuni.set(item.municipality_id, {
        municipality_id: item.municipality_id,
        municipality_name: item.municipality_name || 'Município',
        sort_order: note?.sort_order ?? 9999,
        footnote: note?.footnote || null,
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

  // Ordem estável das categorias no card
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

  municipalities.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return String(a.municipality_name).localeCompare(String(b.municipality_name), 'pt-BR');
  });

  municipalities = municipalities.map((m, idx) => ({
    ...m,
    index: idx + 1,
  }));

  const grand_total = money(municipalities.reduce((s, m) => s + m.total, 0));

  return {
    title: 'Investimentos por Município',
    eyebrow: 'Dossiê regional · Estado de Mato Grosso',
    subtitle:
      'Levantamento organizado por município, com o total viabilizado e a lista item a item nas categorias Infraestrutura, Saúde, Agricultura e Regularização fundiária.',
    municipality_count: municipalities.length,
    item_count: items.length,
    grand_total,
    municipalities,
    categories: CATEGORIES,
    items,
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
  return 'outros';
}

/**
 * Aceita JSON, array JS (`const municipios = [...]`) ou HTML com o script embutido.
 */
function parseDossierPaste(raw) {
  let text = String(raw || '').trim();
  if (!text) {
    const err = new Error('Cole o texto do dossiê (JSON ou o array municipios do HTML)');
    err.status = 400;
    throw err;
  }

  // Extrai do HTML/script se veio a página inteira
  const scriptMatch = text.match(/const\s+municipios\s*=\s*(\[[\s\S]*?\]);\s*(?:function|const|let|var|<\/script>)/i)
    || text.match(/(?:const\s+|let\s+|var\s+)?municipios\s*=\s*(\[[\s\S]*\])/i);
  if (scriptMatch) {
    text = scriptMatch[1];
  }

  // Tenta JSON primeiro
  try {
    const asJson = JSON.parse(text);
    if (Array.isArray(asJson)) return normalizeMunicipiosInput(asJson);
    if (Array.isArray(asJson?.municipios)) return normalizeMunicipiosInput(asJson.municipios);
  } catch {
    /* segue para literal JS */
  }

  try {
    // Entrada confiável da própria equipe — avalia literal de array/objeto
    // eslint-disable-next-line no-new-func
    const evaluated = Function(`"use strict"; return (${text});`)();
    if (Array.isArray(evaluated)) return normalizeMunicipiosInput(evaluated);
    if (Array.isArray(evaluated?.municipios)) return normalizeMunicipiosInput(evaluated.municipios);
  } catch (err) {
    const e = new Error(
      'Não entendi o texto. Cole o array `municipios = [...]` do HTML, ou um JSON com a lista.',
    );
    e.status = 400;
    e.detail = err.message;
    throw e;
  }

  const err = new Error('Formato inválido — esperado uma lista de municípios');
  err.status = 400;
  throw err;
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
 * Substitui o dossiê da campanha pelo conteúdo parseado (apaga e recria).
 */
function importDossier(db, campaignId, municipiosInput) {
  const municipios = Array.isArray(municipiosInput)
    ? normalizeMunicipiosInput(municipiosInput)
    : parseDossierPaste(municipiosInput);

  if (!municipios.length) {
    const err = new Error('Nenhum município encontrado no texto');
    err.status = 400;
    throw err;
  }

  const findMuni = db.prepare('SELECT id, name FROM municipalities WHERE LOWER(name) = LOWER(?)');
  // removed broken COLLATE approach
  const missing = [];
  const resolved = [];

  for (const block of municipios) {
    const muni = findMuni.get(block.nome);
    if (!muni) {
      missing.push(block.nome);
      continue;
    }
    resolved.push({ ...block, municipality_id: muni.id });
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
      campaign_id, municipality_id, category, description, amount, notes, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const clearItems = db.prepare('DELETE FROM campaign_investments WHERE campaign_id = ?');
  const clearNotes = db.prepare('DELETE FROM campaign_investment_muni_notes WHERE campaign_id = ?');
  const insertNote = db.prepare(`
    INSERT INTO campaign_investment_muni_notes (campaign_id, municipality_id, footnote, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  let inserted = 0;
  const run = () => {
    clearItems.run(campaignId);
    clearNotes.run(campaignId);
    for (const block of resolved) {
      if (block.nota || block.sort_order != null) {
        insertNote.run(campaignId, block.municipality_id, block.nota || null, block.sort_order || 0);
      }
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
    municipalities_imported: resolved.length,
    municipalities_missing: missing,
    items_inserted: inserted,
    dossier: buildDossier(db, campaignId),
  };
}

function loadOfficialDossierSeed() {
  return require('./data/dossier-investments-seed');
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
  importDossier,
  loadOfficialDossierSeed,
  AMOUNT_UNKNOWN,
};
