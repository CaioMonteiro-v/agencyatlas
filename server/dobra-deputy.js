/**
 * Deputado Estadual da dobra ≠ coordenador regional da campanha.
 * Ex.: grupos "BETO DOIS A UM …" → Dep. Beto Dois a Um
 *      Beto Correa = coordenador em Cuiabá (não vira card).
 */

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function samePerson(a, b) {
  return fold(a) === fold(b);
}

/** Detecta o deputado pelo nome do grupo WhatsApp. */
function inferDeputyFromGroupName(name) {
  const u = fold(name);
  if (!u) return null;
  if (
    u.includes('BETO DOIS A UM')
    || u.includes('BETO 2 A 1')
    || u.includes('BETO DOIS A 1')
    || u.includes('BETO 2A1')
    || u.includes('BETO DOIS-A-UM')
  ) {
    return 'Beto Dois a Um';
  }
  return null;
}

/**
 * Resolve o Deputado Estadual do grupo.
 * Se o nome do grupo já carrega a marca (ex.: BETO DOIS A UM), isso define o card —
 * mesmo que alguém tenha salvado o coordenador da campanha (Beto Correa) por engano.
 */
function resolveDeputyName(row = {}) {
  const inferred = inferDeputyFromGroupName(row.name);
  if (inferred) return inferred;

  const stored = String(row.deputy_name || row.coordinator_label || '').trim() || null;
  const linked = String(row.linked_coordinator_name || '').trim() || null;

  // Não promove coordenador regional a “deputado” no card
  if (stored && linked && samePerson(stored, linked)) return null;
  return stored;
}

/** Corrige linhas no banco a partir do nome do grupo. */
function repairDeputyNames(db) {
  let fixed = 0;
  try {
    const rows = db.prepare(`
      SELECT g.id, g.name, g.deputy_name, g.coordinator_label, c.name AS linked_coordinator_name
      FROM dobra_groups g
      LEFT JOIN coordinators c ON c.id = g.coordinator_id
    `).all();
    const upd = db.prepare(`
      UPDATE dobra_groups
      SET deputy_name = ?, coordinator_label = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    for (const row of rows) {
      const resolved = resolveDeputyName(row);
      if (!resolved) continue;
      const current = String(row.deputy_name || '').trim();
      const label = String(row.coordinator_label || '').trim();
      if (samePerson(current, resolved) && samePerson(label, resolved)) continue;
      try {
        upd.run(resolved, resolved, row.id);
      } catch {
        db.prepare(`
          UPDATE dobra_groups SET deputy_name = ?, coordinator_label = ? WHERE id = ?
        `).run(resolved, resolved, row.id);
      }
      fixed += 1;
    }
  } catch (err) {
    console.warn('repairDeputyNames:', err.message);
  }
  return fixed;
}

module.exports = {
  fold,
  samePerson,
  inferDeputyFromGroupName,
  resolveDeputyName,
  repairDeputyNames,
};
