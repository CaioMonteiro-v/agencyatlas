/**
 * Deputados Estaduais da dobra — cards cadastrados antes dos grupos.
 * Hierarquia:
 *  - Deputado Estadual (card)
 *  - Nosso coordenador (Atlas / campanha Fábio) — já cadastrado
 *  - Coordenador das dobras — quem toca a mobilização após a conversa com a região
 */

function enrichDeputy(row, stats = null) {
  return {
    ...row,
    id: Number(row.id),
    campaign_id: Number(row.campaign_id),
    name: String(row.name || '').trim(),
    campaign_coordinator_id: row.campaign_coordinator_id ? Number(row.campaign_coordinator_id) : null,
    dobra_coordinator_id: row.dobra_coordinator_id ? Number(row.dobra_coordinator_id) : null,
    campaign_coordinator_name: row.campaign_coordinator_name || null,
    dobra_coordinator_name: row.dobra_coordinator_name || null,
    notes: row.notes || null,
    group_count: stats ? stats.group_count : Number(row.group_count || 0),
    members_initial: stats ? stats.members_initial : Number(row.members_initial || 0),
    members_current: stats ? stats.members_current : Number(row.members_current || 0),
    growth: stats
      ? stats.members_current - stats.members_initial
      : Number(row.members_current || 0) - Number(row.members_initial || 0),
  };
}

function listDeputies(db, campaignId) {
  const rows = db.prepare(`
    SELECT d.*,
      cc.name AS campaign_coordinator_name,
      dc.name AS dobra_coordinator_name,
      (
        SELECT COUNT(*) FROM dobra_groups g
        WHERE g.campaign_id = d.campaign_id
          AND g.deputy_id = d.id
          AND COALESCE(g.status, 'ativo') != 'arquivado'
      ) AS group_count,
      (
        SELECT COALESCE(SUM(g.members_initial), 0) FROM dobra_groups g
        WHERE g.campaign_id = d.campaign_id
          AND g.deputy_id = d.id
          AND COALESCE(g.status, 'ativo') != 'arquivado'
      ) AS members_initial,
      (
        SELECT COALESCE(SUM(g.members_current), 0) FROM dobra_groups g
        WHERE g.campaign_id = d.campaign_id
          AND g.deputy_id = d.id
          AND COALESCE(g.status, 'ativo') != 'arquivado'
      ) AS members_current
    FROM dobra_deputies d
    LEFT JOIN coordinators cc ON cc.id = d.campaign_coordinator_id
    LEFT JOIN coordinators dc ON dc.id = d.dobra_coordinator_id
    WHERE d.campaign_id = ?
    ORDER BY d.name ASC
  `).all(campaignId);
  return rows.map((r) => enrichDeputy(r));
}

function getDeputy(db, campaignId, id) {
  const row = db.prepare(`
    SELECT d.*,
      cc.name AS campaign_coordinator_name,
      dc.name AS dobra_coordinator_name
    FROM dobra_deputies d
    LEFT JOIN coordinators cc ON cc.id = d.campaign_coordinator_id
    LEFT JOIN coordinators dc ON dc.id = d.dobra_coordinator_id
    WHERE d.campaign_id = ? AND d.id = ?
  `).get(campaignId, Number(id));
  return row ? enrichDeputy(row) : null;
}

function assertCoordinator(db, campaignId, coordinatorId, label) {
  if (!coordinatorId) return null;
  const row = db.prepare('SELECT id, name, coord_type FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(Number(coordinatorId), campaignId);
  if (!row) {
    const err = new Error(`${label} não encontrado no cadastro de coordenadores`);
    err.status = 400;
    throw err;
  }
  return row;
}

function createDeputy(db, campaignId, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Informe o nome do Deputado Estadual');
    err.status = 400;
    throw err;
  }
  const campaignCoordinatorId = body.campaign_coordinator_id
    ? Number(body.campaign_coordinator_id)
    : null;
  const dobraCoordinatorId = body.dobra_coordinator_id
    ? Number(body.dobra_coordinator_id)
    : null;
  assertCoordinator(db, campaignId, campaignCoordinatorId, 'Nosso coordenador');
  assertCoordinator(db, campaignId, dobraCoordinatorId, 'Coordenador das dobras');

  const dup = db.prepare(`
    SELECT id FROM dobra_deputies
    WHERE campaign_id = ? AND LOWER(TRIM(name)) = LOWER(?)
  `).get(campaignId, name);
  if (dup) {
    const err = new Error('Já existe um card com esse Deputado Estadual');
    err.status = 400;
    throw err;
  }

  const result = db.prepare(`
    INSERT INTO dobra_deputies (
      campaign_id, name, campaign_coordinator_id, dobra_coordinator_id, notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    campaignId,
    name,
    campaignCoordinatorId,
    dobraCoordinatorId,
    body.notes ? String(body.notes).trim() : null,
  );
  return getDeputy(db, campaignId, result.lastInsertRowid);
}

function updateDeputy(db, campaignId, id, body = {}) {
  const existing = getDeputy(db, campaignId, id);
  if (!existing) {
    const err = new Error('Deputado não encontrado');
    err.status = 404;
    throw err;
  }
  const name = body.name !== undefined ? String(body.name || '').trim() : existing.name;
  if (!name) {
    const err = new Error('Informe o nome do Deputado Estadual');
    err.status = 400;
    throw err;
  }
  const campaignCoordinatorId = body.campaign_coordinator_id !== undefined
    ? (body.campaign_coordinator_id ? Number(body.campaign_coordinator_id) : null)
    : existing.campaign_coordinator_id;
  const dobraCoordinatorId = body.dobra_coordinator_id !== undefined
    ? (body.dobra_coordinator_id ? Number(body.dobra_coordinator_id) : null)
    : existing.dobra_coordinator_id;
  assertCoordinator(db, campaignId, campaignCoordinatorId, 'Nosso coordenador');
  assertCoordinator(db, campaignId, dobraCoordinatorId, 'Coordenador das dobras');

  if (name.toLowerCase() !== existing.name.toLowerCase()) {
    const dup = db.prepare(`
      SELECT id FROM dobra_deputies
      WHERE campaign_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND id != ?
    `).get(campaignId, name, Number(id));
    if (dup) {
      const err = new Error('Já existe um card com esse Deputado Estadual');
      err.status = 400;
      throw err;
    }
  }

  db.prepare(`
    UPDATE dobra_deputies SET
      name = ?,
      campaign_coordinator_id = ?,
      dobra_coordinator_id = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ? AND id = ?
  `).run(
    name,
    campaignCoordinatorId,
    dobraCoordinatorId,
    body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : existing.notes,
    campaignId,
    Number(id),
  );

  // Mantém o nome desnormalizado nos grupos
  try {
    db.prepare(`
      UPDATE dobra_groups SET deputy_name = ?, coordinator_label = ?, updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ? AND deputy_id = ?
    `).run(name, name, campaignId, Number(id));
  } catch {
    db.prepare(`
      UPDATE dobra_groups SET deputy_name = ?, coordinator_label = ?
      WHERE campaign_id = ? AND deputy_id = ?
    `).run(name, name, campaignId, Number(id));
  }

  return getDeputy(db, campaignId, id);
}

function deleteDeputy(db, campaignId, id) {
  const existing = getDeputy(db, campaignId, id);
  if (!existing) {
    const err = new Error('Deputado não encontrado');
    err.status = 404;
    throw err;
  }
  const linked = db.prepare(`
    SELECT COUNT(*) AS n FROM dobra_groups WHERE campaign_id = ? AND deputy_id = ?
  `).get(campaignId, Number(id));
  if (linked && Number(linked.n) > 0) {
    const err = new Error('Há grupos vinculados a este deputado. Remova ou mova os grupos antes.');
    err.status = 400;
    throw err;
  }
  db.prepare('DELETE FROM dobra_deputies WHERE campaign_id = ? AND id = ?').run(campaignId, Number(id));
  return { ok: true, deleted: 1 };
}

/**
 * Cria cards a partir de deputy_name já usados nos grupos (ex.: Beto Dois a Um).
 */
function backfillDeputiesFromGroups(db, campaignId = null) {
  let created = 0;
  let linked = 0;
  try {
    const campaigns = campaignId
      ? [{ id: campaignId }]
      : db.prepare('SELECT id FROM campaigns').all();
    for (const camp of campaigns) {
      const names = db.prepare(`
        SELECT DISTINCT TRIM(COALESCE(deputy_name, coordinator_label, '')) AS nm
        FROM dobra_groups
        WHERE campaign_id = ?
          AND TRIM(COALESCE(deputy_name, coordinator_label, '')) != ''
      `).all(camp.id);
      for (const row of names) {
        const name = String(row.nm || '').trim();
        if (!name || name.toLowerCase() === 'sem deputado') continue;
        let deputy = db.prepare(`
          SELECT id FROM dobra_deputies
          WHERE campaign_id = ? AND LOWER(TRIM(name)) = LOWER(?)
        `).get(camp.id, name);
        if (!deputy) {
          const r = db.prepare(`
            INSERT INTO dobra_deputies (campaign_id, name) VALUES (?, ?)
          `).run(camp.id, name);
          deputy = { id: r.lastInsertRowid };
          created += 1;
        }
        const upd = db.prepare(`
          UPDATE dobra_groups
          SET deputy_id = ?, deputy_name = ?
          WHERE campaign_id = ?
            AND deputy_id IS NULL
            AND LOWER(TRIM(COALESCE(deputy_name, coordinator_label, ''))) = LOWER(?)
        `).run(deputy.id, name, camp.id, name);
        linked += upd.changes || 0;
      }
    }
  } catch (err) {
    console.warn('backfillDeputiesFromGroups:', err.message);
  }
  return { created, linked };
}

module.exports = {
  listDeputies,
  getDeputy,
  createDeputy,
  updateDeputy,
  deleteDeputy,
  backfillDeputiesFromGroups,
  enrichDeputy,
};
