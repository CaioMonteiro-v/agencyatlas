/**
 * Dossiê regional de investimentos (emendas / viabilizações) por município.
 * Manual — sem Meta/Instagram. Foco: MT, card por município, categorias accordion.
 */

const CATEGORIES = [
  { id: 'infraestrutura', label: 'Infraestrutura', color: '#3d5c45' },
  { id: 'saude', label: 'Saúde', color: '#8b4a3b' },
  { id: 'agricultura', label: 'Agricultura', color: '#9a6b2f' },
  { id: 'regularizacao', label: 'Regularização fundiária', color: '#5a6b7a' },
  { id: 'outros', label: 'Outros', color: '#5a5a5a' },
];

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function enrichRow(row) {
  const meta = categoryMeta(row.category);
  return {
    ...row,
    amount: money(row.amount),
    category_label: meta.label,
    category_color: meta.color,
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
    muni.total = money(muni.total + item.amount);
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
    cat.total = money(cat.total + item.amount);
    cat.count += 1;
    cat.items.push({
      id: item.id,
      description: item.description,
      amount: item.amount,
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
    total: money(items.reduce((s, r) => s + money(r.amount), 0)),
    count: items.length,
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
};
