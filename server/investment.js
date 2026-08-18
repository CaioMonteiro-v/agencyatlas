/**
 * Relatório de investimento da campanha — lançamentos manuais por coordenador.
 * Sem relação com Meta/Instagram/Bitly: só o que foi investido no território.
 */

const CATEGORIES = [
  { id: 'combustivel', label: 'Combustível / transporte' },
  { id: 'material', label: 'Material gráfico' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'publicidade', label: 'Publicidade / impulsionamento' },
  { id: 'equipe', label: 'Equipe / diárias' },
  { id: 'eventos', label: 'Eventos / estrutura' },
  { id: 'hospedagem', label: 'Hospedagem' },
  { id: 'comunicacao', label: 'Comunicação / internet' },
  { id: 'outros', label: 'Outros' },
];

function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || id || 'Outros';
}

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function enrichRow(row) {
  return {
    ...row,
    amount: money(row.amount),
    category_label: categoryLabel(row.category),
  };
}

function listInvestments(db, campaignId, { coordinatorId, category, from, to } = {}) {
  let sql = `
    SELECT i.*,
      c.name AS coordinator_name,
      m.name AS municipality_name
    FROM campaign_investments i
    LEFT JOIN coordinators c ON c.id = i.coordinator_id
    LEFT JOIN municipalities m ON m.id = i.municipality_id
    WHERE i.campaign_id = ?
  `;
  const params = [campaignId];

  if (coordinatorId) {
    sql += ' AND i.coordinator_id = ?';
    params.push(Number(coordinatorId));
  }
  if (category) {
    sql += ' AND i.category = ?';
    params.push(String(category));
  }
  if (from) {
    sql += ' AND i.invested_at >= ?';
    params.push(String(from).slice(0, 10));
  }
  if (to) {
    sql += ' AND i.invested_at <= ?';
    params.push(String(to).slice(0, 10));
  }

  sql += ' ORDER BY i.invested_at DESC, i.id DESC';
  return db.prepare(sql).all(...params).map(enrichRow);
}

function buildSummary(items) {
  const total = money(items.reduce((s, r) => s + money(r.amount), 0));
  const byCoordinatorMap = new Map();
  const byCategoryMap = new Map();

  for (const item of items) {
    const coordKey = item.coordinator_id || 0;
    const coordName = item.coordinator_name || 'Campanha (sem coordenador)';
    if (!byCoordinatorMap.has(coordKey)) {
      byCoordinatorMap.set(coordKey, {
        coordinator_id: item.coordinator_id || null,
        coordinator_name: coordName,
        total: 0,
        count: 0,
      });
    }
    const c = byCoordinatorMap.get(coordKey);
    c.total = money(c.total + money(item.amount));
    c.count += 1;

    const cat = item.category || 'outros';
    if (!byCategoryMap.has(cat)) {
      byCategoryMap.set(cat, {
        category: cat,
        category_label: categoryLabel(cat),
        total: 0,
        count: 0,
      });
    }
    const k = byCategoryMap.get(cat);
    k.total = money(k.total + money(item.amount));
    k.count += 1;
  }

  const by_coordinator = [...byCoordinatorMap.values()]
    .map((row) => ({
      ...row,
      pct: total ? Math.round((row.total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const by_category = [...byCategoryMap.values()]
    .map((row) => ({
      ...row,
      pct: total ? Math.round((row.total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total,
    count: items.length,
    coordinators_with_spend: by_coordinator.filter((c) => c.coordinator_id).length,
    average_per_entry: items.length ? money(total / items.length) : 0,
    by_coordinator,
    by_category,
  };
}

function createInvestment(db, campaignId, body) {
  const amount = money(body.amount);
  if (!(amount > 0)) {
    const err = new Error('Informe um valor maior que zero');
    err.status = 400;
    throw err;
  }

  const category = String(body.category || 'outros').trim() || 'outros';
  const investedAt = body.invested_at
    ? String(body.invested_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const description = String(body.description || '').trim();
  if (!description) {
    const err = new Error('Descrição do investimento é obrigatória');
    err.status = 400;
    throw err;
  }

  const result = db.prepare(`
    INSERT INTO campaign_investments (
      campaign_id, coordinator_id, municipality_id, category, description,
      amount, invested_at, receipt_ref, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    body.coordinator_id ? Number(body.coordinator_id) : null,
    body.municipality_id ? Number(body.municipality_id) : null,
    category,
    description,
    amount,
    investedAt,
    body.receipt_ref ? String(body.receipt_ref).trim() : null,
    body.notes ? String(body.notes).trim() : null,
    body.created_by ? String(body.created_by).trim() : null,
  );

  return getInvestment(db, campaignId, result.lastInsertRowid);
}

function getInvestment(db, campaignId, id) {
  const row = db.prepare(`
    SELECT i.*,
      c.name AS coordinator_name,
      m.name AS municipality_name
    FROM campaign_investments i
    LEFT JOIN coordinators c ON c.id = i.coordinator_id
    LEFT JOIN municipalities m ON m.id = i.municipality_id
    WHERE i.id = ? AND i.campaign_id = ?
  `).get(id, campaignId);
  return row ? enrichRow(row) : null;
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
    const err = new Error('Descrição do investimento é obrigatória');
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
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND campaign_id = ?
  `).run(
    body.coordinator_id !== undefined
      ? (body.coordinator_id ? Number(body.coordinator_id) : null)
      : existing.coordinator_id,
    body.municipality_id !== undefined
      ? (body.municipality_id ? Number(body.municipality_id) : null)
      : existing.municipality_id,
    body.category !== undefined ? String(body.category || 'outros') : existing.category,
    description,
    amount,
    body.invested_at !== undefined
      ? String(body.invested_at).slice(0, 10)
      : existing.invested_at,
    body.receipt_ref !== undefined
      ? (body.receipt_ref ? String(body.receipt_ref).trim() : null)
      : existing.receipt_ref,
    body.notes !== undefined
      ? (body.notes ? String(body.notes).trim() : null)
      : existing.notes,
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

module.exports = {
  CATEGORIES,
  categoryLabel,
  listInvestments,
  buildSummary,
  createInvestment,
  getInvestment,
  updateInvestment,
  deleteInvestment,
};
