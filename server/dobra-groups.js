/**
 * Grupos WhatsApp criados via dobra (material de mobilização).
 * Controle: foto, link de convite + Bitly, membros iniciais → atuais, crescimento.
 */

const fs = require('fs');
const path = require('path');
const { customAlphabet } = require('nanoid');
const storage = require('./supabase-storage');
const { createBitlink, fetchBitlinkAnalytics, bitlyConfigured } = require('./bitly');
const { inferDeputyFromGroupName, resolveDeputyName } = require('./dobra-deputy');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'groups');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function saveGroupPhoto(dataUrl, originalName = 'grupo.jpg') {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const err = new Error('Foto inválida — envie imagem (PNG/JPG/WEBP)');
    err.status = 400;
    throw err;
  }
  const mime = match[1].toLowerCase();
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(mime)) {
    const err = new Error('Formato de imagem não suportado');
    err.status = 400;
    throw err;
  }
  const ext = mime.includes('png') ? 'png'
    : mime.includes('webp') ? 'webp'
      : mime.includes('gif') ? 'gif'
        : 'jpg';
  const filename = `${Date.now()}-${nano()}.${ext}`;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) {
    const err = new Error('Imagem muito grande (máx. 6MB)');
    err.status = 400;
    throw err;
  }

  if (storage.configured()) {
    const uploaded = await storage.uploadPublicImage(buf, {
      mimeType: mime,
      filename,
      folder: 'groups',
    });
    return uploaded.url;
  }

  ensureUploadDir();
  const abs = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(abs, buf);
  return `/uploads/groups/${filename}`;
}

function parseSeries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function enrichGroup(row) {
  const initial = Math.max(0, Number(row.members_initial) || 0);
  const current = Math.max(0, Number(row.members_current) || 0);
  const growth = current - initial;
  const multiplier = initial > 0 ? Math.round((current / initial) * 100) / 100 : null;
  const deputyFromCard = String(row.deputy_card_name || '').trim() || null;
  const deputy = deputyFromCard || resolveDeputyName(row);
  return {
    ...row,
    members_initial: initial,
    members_current: current,
    growth,
    multiplier,
    clicks: Math.max(0, Number(row.clicks) || 0),
    clicks_30d: Math.max(0, Number(row.clicks_30d) || 0),
    clicks_series: parseSeries(row.clicks_series),
    deputy_id: row.deputy_id ? Number(row.deputy_id) : null,
    deputy_name: deputy,
    coordinator_name: deputy,
    coordinator_label: deputy,
    campaign_coordinator_id: row.campaign_coordinator_id
      ? Number(row.campaign_coordinator_id)
      : (row.coordinator_id ? Number(row.coordinator_id) : null),
    dobra_coordinator_id: row.dobra_coordinator_id ? Number(row.dobra_coordinator_id) : null,
    campaign_coordinator_name:
      row.campaign_coordinator_name
      || row.linked_coordinator_name
      || null,
    dobra_coordinator_name: row.dobra_coordinator_name || null,
  };
}

const GROUP_SELECT = `
  SELECT g.*,
    d.name AS deputy_card_name,
    cc.name AS campaign_coordinator_name,
    dc.name AS dobra_coordinator_name,
    COALESCE(cc.name, c.name) AS linked_coordinator_name,
    m.name AS municipality_name
  FROM dobra_groups g
  LEFT JOIN dobra_deputies d ON d.id = g.deputy_id
  LEFT JOIN coordinators cc ON cc.id = COALESCE(g.campaign_coordinator_id, g.coordinator_id)
  LEFT JOIN coordinators dc ON dc.id = g.dobra_coordinator_id
  LEFT JOIN coordinators c ON c.id = g.coordinator_id
  LEFT JOIN municipalities m ON m.id = g.municipality_id
`;

function listGroups(db, campaignId, { coordinatorId, municipalityId, deputyId, status, q } = {}) {
  let sql = `${GROUP_SELECT} WHERE g.campaign_id = ?`;
  const params = [campaignId];
  if (deputyId) {
    sql += ' AND g.deputy_id = ?';
    params.push(Number(deputyId));
  }
  if (coordinatorId) {
    sql += ' AND (g.coordinator_id = ? OR g.campaign_coordinator_id = ? OR g.dobra_coordinator_id = ?)';
    params.push(Number(coordinatorId), Number(coordinatorId), Number(coordinatorId));
  }
  if (municipalityId) {
    sql += ' AND g.municipality_id = ?';
    params.push(Number(municipalityId));
  }
  if (status) {
    sql += ' AND g.status = ?';
    params.push(String(status));
  }
  if (q) {
    sql += ` AND (
      LOWER(COALESCE(d.name, g.deputy_name, g.coordinator_label, '')) LIKE LOWER(?)
      OR LOWER(g.name) LIKE LOWER(?)
    )`;
    const like = `%${String(q).trim()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY g.opened_at DESC NULLS LAST, g.id DESC';
  try {
    return db.prepare(sql).all(...params).map(enrichGroup);
  } catch {
    sql = sql.replace(' NULLS LAST', '');
    return db.prepare(sql).all(...params).map(enrichGroup);
  }
}

function buildSummary(groups) {
  const list = groups || [];
  const active = list.filter((g) => g.status !== 'arquivado');
  const initial = active.reduce((s, g) => s + g.members_initial, 0);
  const current = active.reduce((s, g) => s + g.members_current, 0);
  const clicks = active.reduce((s, g) => s + g.clicks, 0);
  return {
    groups_total: list.length,
    groups_active: active.length,
    members_initial: initial,
    members_current: current,
    growth: current - initial,
    multiplier: initial > 0 ? Math.round((current / initial) * 100) / 100 : null,
    clicks_total: clicks,
    with_photo: active.filter((g) => g.photo_url).length,
    with_bitly: active.filter((g) => g.bitly_url).length,
  };
}

function getGroup(db, campaignId, id) {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.campaign_id = ? AND g.id = ?`)
    .get(campaignId, Number(id));
  return row ? enrichGroup(row) : null;
}

function resolveDeputyForWrite(db, campaignId, body, groupName) {
  let deputyId = body.deputy_id ? Number(body.deputy_id) : null;
  let deputyName = String(
    body.deputy_name || body.coordinator_label || body.coordinator_name || '',
  ).trim() || null;

  if (deputyId) {
    const card = db.prepare('SELECT * FROM dobra_deputies WHERE id = ? AND campaign_id = ?')
      .get(deputyId, campaignId);
    if (!card) {
      const err = new Error('Selecione um Deputado Estadual cadastrado');
      err.status = 400;
      throw err;
    }
    deputyName = card.name;
    return {
      deputyId,
      deputyName,
      campaignCoordinatorId: body.campaign_coordinator_id !== undefined
        ? (body.campaign_coordinator_id ? Number(body.campaign_coordinator_id) : null)
        : (card.campaign_coordinator_id || null),
      dobraCoordinatorId: body.dobra_coordinator_id !== undefined
        ? (body.dobra_coordinator_id ? Number(body.dobra_coordinator_id) : null)
        : (card.dobra_coordinator_id || null),
    };
  }

  const inferred = inferDeputyFromGroupName(groupName);
  if (inferred) deputyName = inferred;

  if (deputyName) {
    const existing = db.prepare(`
      SELECT * FROM dobra_deputies
      WHERE campaign_id = ? AND LOWER(TRIM(name)) = LOWER(?)
    `).get(campaignId, deputyName);
    if (existing) {
      deputyId = existing.id;
      deputyName = existing.name;
      return {
        deputyId,
        deputyName,
        campaignCoordinatorId: body.campaign_coordinator_id
          ? Number(body.campaign_coordinator_id)
          : (existing.campaign_coordinator_id || null),
        dobraCoordinatorId: body.dobra_coordinator_id
          ? Number(body.dobra_coordinator_id)
          : (existing.dobra_coordinator_id || null),
      };
    }
  }

  return {
    deputyId: null,
    deputyName,
    campaignCoordinatorId: body.campaign_coordinator_id
      ? Number(body.campaign_coordinator_id)
      : (body.coordinator_id ? Number(body.coordinator_id) : null),
    dobraCoordinatorId: body.dobra_coordinator_id
      ? Number(body.dobra_coordinator_id)
      : null,
  };
}

function assertCoordMuni(db, campaignId, coordinatorId, municipalityId) {
  if (!coordinatorId || !municipalityId) return;
  const coord = db.prepare('SELECT id, coord_type FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(Number(coordinatorId), campaignId);
  if (!coord) {
    const err = new Error('Coordenador não encontrado');
    err.status = 400;
    throw err;
  }
  // Coordenadores de dobra (ex.: Cuiabá) podem atuar em município sem vínculo exclusivo
  if (String(coord.coord_type || '').toLowerCase() === 'dobra') return;

  const ok = db.prepare(`
    SELECT 1 AS ok
    FROM coordinator_municipalities cm
    WHERE cm.coordinator_id = ? AND cm.municipality_id = ?
  `).get(Number(coordinatorId), Number(municipalityId));
  if (!ok) {
    const err = new Error('Esse município não está vinculado a esse coordenador no Atlas');
    err.status = 400;
    throw err;
  }
}

async function createGroup(db, campaignId, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Informe o nome do grupo');
    err.status = 400;
    throw err;
  }

  const inviteLink = String(body.invite_link || body.destination_url || '').trim() || null;
  let destinationUrl = String(body.destination_url || inviteLink || '').trim() || null;
  let bitlyUrl = String(body.bitly_url || '').trim() || null;
  let bitlyError = null;

  const municipalityId = body.municipality_id ? Number(body.municipality_id) : null;
  const resolved = resolveDeputyForWrite(db, campaignId, body, name);
  const deputyId = resolved.deputyId;
  const deputyName = resolved.deputyName;
  const campaignCoordinatorId = resolved.campaignCoordinatorId;
  const dobraCoordinatorId = resolved.dobraCoordinatorId;
  // compat: coordinator_id = nosso coordenador da campanha
  const coordinatorId = campaignCoordinatorId || (body.coordinator_id ? Number(body.coordinator_id) : null);
  if (coordinatorId) assertCoordMuni(db, campaignId, coordinatorId, municipalityId);
  if (!deputyId) {
    const err = new Error('Selecione o Deputado Estadual (cadastre o card antes)');
    err.status = 400;
    throw err;
  }

  let photoUrl = String(body.photo_url || '').trim() || null;
  if (body.photo_data_url) {
    photoUrl = await saveGroupPhoto(body.photo_data_url, body.photo_name || `${name}.jpg`);
  }

  const membersInitial = Math.max(0, Number(body.members_initial) || 0);
  const membersCurrent = body.members_current != null
    ? Math.max(0, Number(body.members_current) || 0)
    : membersInitial;

  // Bitly automático a partir do convite (estratégia de links separados por grupo)
  if (!bitlyUrl && destinationUrl && bitlyConfigured()) {
    try {
      const created = await createBitlink(destinationUrl, {
        title: `Dobra · ${name}`.slice(0, 120),
        tags: ['dobra', 'grupo', 'atlas'],
      });
      bitlyUrl = created.bitly_url;
      destinationUrl = created.destination_url || destinationUrl;
    } catch (err) {
      bitlyError = err.message || 'Falha ao criar Bitly';
    }
  }

  const result = db.prepare(`
    INSERT INTO dobra_groups (
      campaign_id, name, photo_url, invite_link, bitly_url, destination_url,
      members_initial, members_current, coordinator_id, coordinator_label, deputy_name,
      deputy_id, campaign_coordinator_id, dobra_coordinator_id, municipality_id,
      notes, status, opened_at, bitly_last_error, members_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    campaignId,
    name,
    photoUrl,
    inviteLink,
    bitlyUrl,
    destinationUrl,
    membersInitial,
    membersCurrent,
    coordinatorId,
    deputyName,
    deputyName,
    deputyId,
    campaignCoordinatorId,
    dobraCoordinatorId,
    municipalityId,
    body.notes ? String(body.notes).trim() : null,
    body.status === 'arquivado' ? 'arquivado' : 'ativo',
    body.opened_at ? String(body.opened_at).slice(0, 32) : new Date().toISOString().slice(0, 10),
    bitlyError,
  );

  const id = result.lastInsertRowid;
  const group = getGroup(db, campaignId, id);
  return { group, bitly_error: bitlyError };
}

async function updateGroup(db, campaignId, id, body = {}) {
  const existing = getGroup(db, campaignId, id);
  if (!existing) {
    const err = new Error('Grupo não encontrado');
    err.status = 404;
    throw err;
  }

  const municipalityId = body.municipality_id !== undefined
    ? (body.municipality_id ? Number(body.municipality_id) : null)
    : existing.municipality_id;

  const writeBody = {
    deputy_id: body.deputy_id !== undefined ? body.deputy_id : existing.deputy_id,
    deputy_name: body.deputy_name !== undefined ? body.deputy_name : existing.deputy_name,
    coordinator_label: body.coordinator_label,
    coordinator_name: body.coordinator_name,
    campaign_coordinator_id: body.campaign_coordinator_id !== undefined
      ? body.campaign_coordinator_id
      : (body.coordinator_id !== undefined ? body.coordinator_id : existing.campaign_coordinator_id),
    dobra_coordinator_id: body.dobra_coordinator_id !== undefined
      ? body.dobra_coordinator_id
      : existing.dobra_coordinator_id,
    coordinator_id: body.coordinator_id,
  };
  const groupNameForInfer = body.name != null ? String(body.name).trim() : existing.name;
  const resolved = resolveDeputyForWrite(db, campaignId, writeBody, groupNameForInfer);
  const deputyId = resolved.deputyId || existing.deputy_id || null;
  const deputyName = resolved.deputyName || existing.deputy_name || null;
  const campaignCoordinatorId = resolved.campaignCoordinatorId
    ?? existing.campaign_coordinator_id
    ?? existing.coordinator_id
    ?? null;
  const dobraCoordinatorId = resolved.dobraCoordinatorId
    ?? existing.dobra_coordinator_id
    ?? null;
  const coordinatorId = campaignCoordinatorId;
  if (coordinatorId) assertCoordMuni(db, campaignId, coordinatorId, municipalityId);

  let photoUrl = existing.photo_url;
  if (body.photo_data_url) {
    photoUrl = await saveGroupPhoto(body.photo_data_url, body.photo_name || `${existing.name}.jpg`);
  } else if (body.photo_url !== undefined) {
    photoUrl = body.photo_url ? String(body.photo_url).trim() : null;
  }

  let inviteLink = body.invite_link !== undefined
    ? (String(body.invite_link || '').trim() || null)
    : existing.invite_link;
  let destinationUrl = body.destination_url !== undefined
    ? (String(body.destination_url || '').trim() || null)
    : (existing.destination_url || inviteLink);
  let bitlyUrl = body.bitly_url !== undefined
    ? (String(body.bitly_url || '').trim() || null)
    : existing.bitly_url;
  let bitlyError = existing.bitly_last_error;
  let bitlySyncedAt = existing.bitly_synced_at;

  const membersInitial = body.members_initial !== undefined
    ? Math.max(0, Number(body.members_initial) || 0)
    : existing.members_initial;
  const membersCurrent = body.members_current !== undefined
    ? Math.max(0, Number(body.members_current) || 0)
    : existing.members_current;
  const membersChanged = body.members_current !== undefined || body.members_initial !== undefined;

  // Criar Bitly se ainda não tem e tem destino
  if (body.create_bitly && !bitlyUrl) {
    const longUrl = destinationUrl || inviteLink;
    if (!longUrl) {
      const err = new Error('Informe o link de convite do WhatsApp para gerar o Bitly');
      err.status = 400;
      throw err;
    }
    if (!bitlyConfigured()) {
      const err = new Error('Configure BITLY_ACCESS_TOKEN no Render para criar links');
      err.status = 503;
      throw err;
    }
    const created = await createBitlink(longUrl, {
      title: `Dobra · ${body.name || existing.name}`.slice(0, 120),
      tags: ['dobra', 'grupo', 'atlas'],
    });
    bitlyUrl = created.bitly_url;
    destinationUrl = created.destination_url || longUrl;
    bitlyError = null;
  }

  db.prepare(`
    UPDATE dobra_groups SET
      name = ?,
      photo_url = ?,
      invite_link = ?,
      bitly_url = ?,
      destination_url = ?,
      members_initial = ?,
      members_current = ?,
      coordinator_id = ?,
      coordinator_label = ?,
      deputy_name = ?,
      deputy_id = ?,
      campaign_coordinator_id = ?,
      dobra_coordinator_id = ?,
      municipality_id = ?,
      notes = ?,
      status = ?,
      opened_at = ?,
      bitly_last_error = ?,
      members_updated_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE members_updated_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ? AND id = ?
  `).run(
    body.name != null ? String(body.name).trim() : existing.name,
    photoUrl,
    inviteLink,
    bitlyUrl,
    destinationUrl,
    membersInitial,
    membersCurrent,
    coordinatorId,
    deputyName,
    deputyName,
    deputyId,
    campaignCoordinatorId,
    dobraCoordinatorId,
    municipalityId,
    body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : existing.notes,
    body.status === 'arquivado' ? 'arquivado' : (body.status === 'ativo' ? 'ativo' : existing.status),
    body.opened_at !== undefined
      ? (body.opened_at ? String(body.opened_at).slice(0, 32) : null)
      : existing.opened_at,
    bitlyError,
    membersChanged ? 1 : 0,
    campaignId,
    Number(id),
  );

  return getGroup(db, campaignId, id);
}

function deleteGroup(db, campaignId, id) {
  const result = db.prepare('DELETE FROM dobra_groups WHERE campaign_id = ? AND id = ?')
    .run(campaignId, Number(id));
  return { ok: true, deleted: result.changes || 0 };
}

async function syncGroupBitly(db, campaignId, id) {
  const group = getGroup(db, campaignId, id);
  if (!group) {
    const err = new Error('Grupo não encontrado');
    err.status = 404;
    throw err;
  }
  if (!group.bitly_url) {
    const err = new Error('Este grupo ainda não tem link Bitly');
    err.status = 400;
    throw err;
  }

  const analytics = await fetchBitlinkAnalytics(group.bitly_url);
  if (!analytics.ok) {
    db.prepare(`
      UPDATE dobra_groups SET bitly_last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(String(analytics.error || 'erro').slice(0, 280), group.id);
    const err = new Error(analytics.error || 'Falha ao sincronizar Bitly');
    err.status = 502;
    throw err;
  }

  db.prepare(`
    UPDATE dobra_groups SET
      clicks = ?,
      clicks_30d = ?,
      clicks_series = ?,
      bitly_synced_at = ?,
      bitly_last_error = NULL,
      destination_url = COALESCE(?, destination_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    analytics.total_clicks,
    analytics.clicks_30d,
    JSON.stringify(analytics.series || []),
    analytics.synced_at,
    analytics.destination_url || null,
    group.id,
  );

  return getGroup(db, campaignId, id);
}

async function syncAllGroupBitly(db, campaignId) {
  const groups = listGroups(db, campaignId).filter((g) => g.bitly_url && g.status !== 'arquivado');
  const results = [];
  for (const g of groups) {
    try {
      const updated = await syncGroupBitly(db, campaignId, g.id);
      results.push({ id: g.id, ok: true, clicks: updated.clicks });
    } catch (err) {
      results.push({ id: g.id, ok: false, error: err.message });
    }
  }
  return {
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    groups: listGroups(db, campaignId),
    summary: buildSummary(listGroups(db, campaignId)),
  };
}

module.exports = {
  listGroups,
  buildSummary,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  syncGroupBitly,
  syncAllGroupBitly,
  saveGroupPhoto,
};
