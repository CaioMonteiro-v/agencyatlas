/**
 * Funil de demandas territoriais (coordenador → município).
 * Cada demanda é um "para": o que houve, data, prints, status standby/resolvido.
 */

const fs = require('fs');
const path = require('path');
const { customAlphabet } = require('nanoid');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'demands');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function parseAttachmentsJson(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function enrichDemand(row) {
  return {
    ...row,
    attachments: parseAttachmentsJson(row.attachments),
  };
}

function listDemands(db, { campaignId, coordinatorId, municipalityId, status } = {}) {
  let sql = `
    SELECT d.*,
      c.name AS coordinator_name,
      m.name AS municipality_name
    FROM territory_demands d
    JOIN coordinators c ON c.id = d.coordinator_id
    JOIN municipalities m ON m.id = d.municipality_id
    WHERE d.campaign_id = ?
  `;
  const params = [campaignId];

  if (coordinatorId) {
    sql += ' AND d.coordinator_id = ?';
    params.push(Number(coordinatorId));
  }
  if (municipalityId) {
    sql += ' AND d.municipality_id = ?';
    params.push(Number(municipalityId));
  }
  if (status === 'standby' || status === 'resolvido') {
    sql += ' AND d.status = ?';
    params.push(status);
  }

  sql += `
    ORDER BY
      CASE WHEN d.status = 'standby' THEN 0 ELSE 1 END,
      d.occurred_at DESC,
      d.id DESC
  `;

  return db.prepare(sql).all(...params).map(enrichDemand);
}

function demandCountsByMunicipality(db, campaignId, coordinatorId) {
  return db.prepare(`
    SELECT
      municipality_id,
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END), 0) AS standby,
      COALESCE(SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END), 0) AS resolvido
    FROM territory_demands
    WHERE campaign_id = ? AND coordinator_id = ?
    GROUP BY municipality_id
  `).all(campaignId, coordinatorId);
}

function demandSummary(db, campaignId) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END), 0) AS standby,
      COALESCE(SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END), 0) AS resolvido
    FROM territory_demands
    WHERE campaign_id = ?
  `).get(campaignId);
  return {
    total: Number(row?.total) || 0,
    standby: Number(row?.standby) || 0,
    resolvido: Number(row?.resolvido) || 0,
  };
}

function saveDataUrlAttachment(dataUrl, originalName = 'print.png') {
  ensureUploadDir();
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const err = new Error('Print inválido — envie imagem (PNG/JPG/WEBP)');
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
  const abs = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) {
    const err = new Error('Imagem muito grande (máx. 6MB)');
    err.status = 400;
    throw err;
  }
  fs.writeFileSync(abs, buf);
  return {
    url: `/uploads/demands/${filename}`,
    original_name: String(originalName || filename).slice(0, 180),
    mime_type: mime,
    size: buf.length,
  };
}

function createDemand(db, payload) {
  const attachments = [];
  for (const item of payload.attachments || []) {
    if (item?.data_url) {
      attachments.push(saveDataUrlAttachment(item.data_url, item.name));
    } else if (item?.url) {
      attachments.push({
        url: item.url,
        original_name: item.original_name || item.name || 'anexo',
        mime_type: item.mime_type || null,
      });
    }
  }

  const result = db.prepare(`
    INSERT INTO territory_demands (
      campaign_id, coordinator_id, municipality_id,
      title, description, occurred_at, status,
      unresolved_reason, resolution_notes, created_by, attachments
    ) VALUES (?, ?, ?, ?, ?, ?, 'standby', ?, NULL, ?, ?)
  `).run(
    payload.campaign_id,
    payload.coordinator_id,
    payload.municipality_id,
    payload.title || null,
    payload.description,
    payload.occurred_at || new Date().toISOString().slice(0, 10),
    payload.unresolved_reason || null,
    payload.created_by || null,
    JSON.stringify(attachments),
  );

  const row = db.prepare(`
    SELECT d.*, c.name AS coordinator_name, m.name AS municipality_name
    FROM territory_demands d
    JOIN coordinators c ON c.id = d.coordinator_id
    JOIN municipalities m ON m.id = d.municipality_id
    WHERE d.id = ?
  `).get(result.lastInsertRowid);

  return enrichDemand(row);
}

function updateDemand(db, demandId, patch) {
  const current = db.prepare('SELECT * FROM territory_demands WHERE id = ?').get(demandId);
  if (!current) return null;

  let attachments = parseAttachmentsJson(current.attachments);
  if (Array.isArray(patch.add_attachments) && patch.add_attachments.length) {
    for (const item of patch.add_attachments) {
      if (item?.data_url) {
        attachments.push(saveDataUrlAttachment(item.data_url, item.name));
      }
    }
  }

  const status = patch.status === 'resolvido' || patch.status === 'standby'
    ? patch.status
    : current.status;

  const resolvedAt = status === 'resolvido'
    ? (current.resolved_at || new Date().toISOString())
    : null;

  db.prepare(`
    UPDATE territory_demands SET
      title = ?,
      description = ?,
      occurred_at = ?,
      status = ?,
      unresolved_reason = ?,
      resolution_notes = ?,
      resolved_at = ?,
      attachments = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    patch.title !== undefined ? (patch.title || null) : current.title,
    patch.description !== undefined ? patch.description : current.description,
    patch.occurred_at !== undefined ? patch.occurred_at : current.occurred_at,
    status,
    patch.unresolved_reason !== undefined ? (patch.unresolved_reason || null) : current.unresolved_reason,
    patch.resolution_notes !== undefined ? (patch.resolution_notes || null) : current.resolution_notes,
    resolvedAt,
    JSON.stringify(attachments),
    demandId,
  );

  const row = db.prepare(`
    SELECT d.*, c.name AS coordinator_name, m.name AS municipality_name
    FROM territory_demands d
    JOIN coordinators c ON c.id = d.coordinator_id
    JOIN municipalities m ON m.id = d.municipality_id
    WHERE d.id = ?
  `).get(demandId);

  return enrichDemand(row);
}

module.exports = {
  listDemands,
  demandCountsByMunicipality,
  demandSummary,
  createDemand,
  updateDemand,
  enrichDemand,
  UPLOAD_DIR,
};
