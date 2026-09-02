/**
 * Vídeos / conteúdos da dobra: 1 URL → N Bitlys (um por grupo WhatsApp).
 * Controle: cliques por grupo, por vídeo, e geração em massa.
 */

const { createBitlink, fetchBitlinkAnalytics, bitlyConfigured, sleep } = require('./bitly');

function enrichVideo(row, linkStats = null) {
  const links_total = linkStats ? linkStats.total : Number(row.links_total || 0);
  const links_ok = linkStats ? linkStats.ok : Number(row.links_ok || 0);
  const clicks = linkStats ? linkStats.clicks : Number(row.clicks_total || 0);
  return {
    ...row,
    id: Number(row.id),
    campaign_id: Number(row.campaign_id),
    title: String(row.title || '').trim(),
    destination_url: row.destination_url || null,
    notes: row.notes || null,
    posted_at: row.posted_at || null,
    status: row.status || 'ativo',
    links_total,
    links_ok,
    links_pending: Math.max(0, links_total - links_ok),
    clicks_total: clicks,
  };
}

function enrichLink(row) {
  return {
    ...row,
    id: Number(row.id),
    video_id: Number(row.video_id),
    group_id: Number(row.group_id),
    clicks: Math.max(0, Number(row.clicks) || 0),
    clicks_30d: Math.max(0, Number(row.clicks_30d) || 0),
    group_name: row.group_name || null,
    deputy_name: row.deputy_name || row.deputy_card_name || null,
  };
}

function listVideos(db, campaignId) {
  const rows = db.prepare(`
    SELECT v.*,
      (SELECT COUNT(*) FROM dobra_video_links l WHERE l.video_id = v.id) AS links_total,
      (SELECT COUNT(*) FROM dobra_video_links l
        WHERE l.video_id = v.id AND l.bitly_url IS NOT NULL AND l.bitly_url != '') AS links_ok,
      (SELECT COALESCE(SUM(l.clicks), 0) FROM dobra_video_links l WHERE l.video_id = v.id) AS clicks_total
    FROM dobra_videos v
    WHERE v.campaign_id = ?
    ORDER BY COALESCE(v.posted_at, v.created_at) DESC, v.id DESC
  `).all(campaignId);
  return rows.map((r) => enrichVideo(r));
}

function getVideo(db, campaignId, id) {
  const row = db.prepare(`
    SELECT v.*,
      (SELECT COUNT(*) FROM dobra_video_links l WHERE l.video_id = v.id) AS links_total,
      (SELECT COUNT(*) FROM dobra_video_links l
        WHERE l.video_id = v.id AND l.bitly_url IS NOT NULL AND l.bitly_url != '') AS links_ok,
      (SELECT COALESCE(SUM(l.clicks), 0) FROM dobra_video_links l WHERE l.video_id = v.id) AS clicks_total
    FROM dobra_videos v
    WHERE v.campaign_id = ? AND v.id = ?
  `).get(campaignId, Number(id));
  return row ? enrichVideo(row) : null;
}

function listVideoLinks(db, campaignId, videoId) {
  const rows = db.prepare(`
    SELECT l.*,
      g.name AS group_name,
      COALESCE(d.name, g.deputy_name, g.coordinator_label) AS deputy_name
    FROM dobra_video_links l
    JOIN dobra_groups g ON g.id = l.group_id
    LEFT JOIN dobra_deputies d ON d.id = g.deputy_id
    WHERE l.campaign_id = ? AND l.video_id = ?
    ORDER BY COALESCE(d.name, g.deputy_name, '') ASC, g.name ASC
  `).all(campaignId, Number(videoId));
  return rows.map(enrichLink);
}

function createVideo(db, campaignId, body = {}) {
  const title = String(body.title || '').trim();
  const destinationUrl = String(body.destination_url || body.url || '').trim();
  if (!title) {
    const err = new Error('Informe o título do vídeo / conteúdo');
    err.status = 400;
    throw err;
  }
  if (!destinationUrl) {
    const err = new Error('Informe a URL do vídeo (Instagram, YouTube, etc.)');
    err.status = 400;
    throw err;
  }
  const result = db.prepare(`
    INSERT INTO dobra_videos (
      campaign_id, title, destination_url, notes, posted_at, status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    title,
    destinationUrl,
    body.notes ? String(body.notes).trim() : null,
    body.posted_at ? String(body.posted_at).slice(0, 32) : new Date().toISOString().slice(0, 10),
    body.status === 'arquivado' ? 'arquivado' : 'ativo',
  );
  return getVideo(db, campaignId, result.lastInsertRowid);
}

function updateVideo(db, campaignId, id, body = {}) {
  const existing = getVideo(db, campaignId, id);
  if (!existing) {
    const err = new Error('Vídeo não encontrado');
    err.status = 404;
    throw err;
  }
  const title = body.title !== undefined ? String(body.title || '').trim() : existing.title;
  const destinationUrl = body.destination_url !== undefined
    ? String(body.destination_url || '').trim()
    : existing.destination_url;
  if (!title || !destinationUrl) {
    const err = new Error('Título e URL são obrigatórios');
    err.status = 400;
    throw err;
  }
  db.prepare(`
    UPDATE dobra_videos SET
      title = ?,
      destination_url = ?,
      notes = ?,
      posted_at = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ? AND id = ?
  `).run(
    title,
    destinationUrl,
    body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : existing.notes,
    body.posted_at !== undefined
      ? (body.posted_at ? String(body.posted_at).slice(0, 32) : null)
      : existing.posted_at,
    body.status === 'arquivado' ? 'arquivado' : (body.status === 'ativo' ? 'ativo' : existing.status),
    campaignId,
    Number(id),
  );
  return getVideo(db, campaignId, id);
}

function deleteVideo(db, campaignId, id) {
  const existing = getVideo(db, campaignId, id);
  if (!existing) {
    const err = new Error('Vídeo não encontrado');
    err.status = 404;
    throw err;
  }
  db.prepare('DELETE FROM dobra_video_links WHERE campaign_id = ? AND video_id = ?')
    .run(campaignId, Number(id));
  db.prepare('DELETE FROM dobra_videos WHERE campaign_id = ? AND id = ?')
    .run(campaignId, Number(id));
  return { ok: true, deleted: 1 };
}

function activeGroups(db, campaignId, { deputyId } = {}) {
  let sql = `
    SELECT g.id, g.name, g.deputy_id, g.deputy_name, g.status
    FROM dobra_groups g
    WHERE g.campaign_id = ? AND COALESCE(g.status, 'ativo') != 'arquivado'
  `;
  const params = [campaignId];
  if (deputyId) {
    sql += ' AND g.deputy_id = ?';
    params.push(Number(deputyId));
  }
  sql += ' ORDER BY g.id ASC';
  return db.prepare(sql).all(...params);
}

/**
 * Gera 1 Bitly por grupo ativo para o vídeo (ex.: 150 links).
 * Só cria os que ainda faltam.
 */
async function generateLinksForVideo(db, campaignId, videoId, { deputyId, limit = 200 } = {}) {
  const video = getVideo(db, campaignId, videoId);
  if (!video) {
    const err = new Error('Vídeo não encontrado');
    err.status = 404;
    throw err;
  }
  if (!bitlyConfigured()) {
    const err = new Error('Configure BITLY_ACCESS_TOKEN no Render para criar links em massa');
    err.status = 503;
    throw err;
  }

  const groups = activeGroups(db, campaignId, { deputyId });
  const existing = new Set(
    db.prepare(`
      SELECT group_id FROM dobra_video_links
      WHERE video_id = ? AND bitly_url IS NOT NULL AND bitly_url != ''
    `).all(Number(videoId)).map((r) => Number(r.group_id)),
  );

  const pending = groups.filter((g) => !existing.has(Number(g.id)));
  const max = Math.min(Math.max(1, Number(limit) || 200), 200);
  const batch = pending.slice(0, max);

  const results = [];
  const insert = db.prepare(`
    INSERT INTO dobra_video_links (
      campaign_id, video_id, group_id, title, bitly_url, destination_url,
      clicks, clicks_30d, bitly_last_error
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL)
  `);
  const upsert = db.prepare(`
    UPDATE dobra_video_links SET
      bitly_url = ?,
      destination_url = ?,
      title = ?,
      bitly_last_error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE video_id = ? AND group_id = ?
  `);
  const findLink = db.prepare(`
    SELECT id FROM dobra_video_links WHERE video_id = ? AND group_id = ?
  `);

  for (let i = 0; i < batch.length; i += 1) {
    const g = batch[i];
    try {
      if (i > 0) await sleep(220);
      const title = `${video.title} · ${g.name}`.slice(0, 120);
      const created = await createBitlink(video.destination_url, {
        title,
        tags: ['dobra', 'video', 'grupo', 'atlas'],
      });
      const found = findLink.get(Number(videoId), Number(g.id));
      if (found) {
        upsert.run(created.bitly_url, created.destination_url || video.destination_url, title, Number(videoId), Number(g.id));
      } else {
        insert.run(
          campaignId,
          Number(videoId),
          Number(g.id),
          title,
          created.bitly_url,
          created.destination_url || video.destination_url,
        );
      }
      results.push({
        group_id: g.id,
        group_name: g.name,
        ok: true,
        bitly_url: created.bitly_url,
      });
    } catch (err) {
      results.push({
        group_id: g.id,
        group_name: g.name,
        ok: false,
        error: err.message,
      });
    }
  }

  return {
    video: getVideo(db, campaignId, videoId),
    links: listVideoLinks(db, campaignId, videoId),
    created: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: Math.max(0, pending.length - batch.length),
    groups_total: groups.length,
    results,
  };
}

async function syncVideoLinks(db, campaignId, videoId) {
  const video = getVideo(db, campaignId, videoId);
  if (!video) {
    const err = new Error('Vídeo não encontrado');
    err.status = 404;
    throw err;
  }
  const links = listVideoLinks(db, campaignId, videoId).filter((l) => l.bitly_url);
  const results = [];
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    try {
      if (i > 0) await sleep(160);
      const analytics = await fetchBitlinkAnalytics(link.bitly_url);
      if (!analytics.ok) {
        db.prepare(`
          UPDATE dobra_video_links SET bitly_last_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(String(analytics.error || 'erro').slice(0, 280), link.id);
        results.push({ id: link.id, ok: false, error: analytics.error });
        continue;
      }
      db.prepare(`
        UPDATE dobra_video_links SET
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
        link.id,
      );
      results.push({ id: link.id, ok: true, clicks: analytics.total_clicks });
    } catch (err) {
      results.push({ id: link.id, ok: false, error: err.message });
    }
  }
  return {
    video: getVideo(db, campaignId, videoId),
    links: listVideoLinks(db, campaignId, videoId),
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

function videoBoard(db, campaignId) {
  const videos = listVideos(db, campaignId);
  const groupsActive = activeGroups(db, campaignId).length;
  return {
    videos,
    groups_active: groupsActive,
    summary: {
      videos: videos.length,
      videos_active: videos.filter((v) => v.status !== 'arquivado').length,
      links_total: videos.reduce((s, v) => s + v.links_ok, 0),
      clicks_total: videos.reduce((s, v) => s + v.clicks_total, 0),
      groups_active: groupsActive,
    },
  };
}

module.exports = {
  listVideos,
  getVideo,
  listVideoLinks,
  createVideo,
  updateVideo,
  deleteVideo,
  generateLinksForVideo,
  syncVideoLinks,
  videoBoard,
  activeGroups,
};
