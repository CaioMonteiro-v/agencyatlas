/**
 * Conteúdos mobilizados — análise estilo Bitly + grupos/canais + território.
 */

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

function enrichMobilizedContent(db, row) {
  const channels = db.prepare(`
    SELECT * FROM mobilized_content_channels
    WHERE mobilized_content_id = ?
    ORDER BY members_count DESC, id DESC
  `).all(row.id);

  const groups = channels.filter((c) => c.channel_type !== 'canal').length;
  const canales = channels.filter((c) => c.channel_type === 'canal').length;
  const audience = channels.reduce((s, c) => s + Math.max(0, Number(c.members_count) || 0), 0);
  const clicks = Math.max(0, Number(row.clicks) || 0);
  const clicksPrev = Math.max(0, Number(row.clicks_prev) || 0);
  const clicks30d = Math.max(0, Number(row.clicks_30d) || 0);
  const views = Math.max(0, Number(row.views) || 0);
  const series = parseSeries(row.clicks_series);
  const peopleClicked = clicks;
  const clicksDelta = clicks - clicksPrev;

  let coordinator_name = null;
  let municipality_name = null;
  if (row.coordinator_id) {
    coordinator_name = db.prepare('SELECT name FROM coordinators WHERE id = ?').get(row.coordinator_id)?.name || null;
  }
  if (row.municipality_id) {
    municipality_name = db.prepare('SELECT name FROM municipalities WHERE id = ?').get(row.municipality_id)?.name || null;
  }

  return {
    ...row,
    clicks_series: series,
    channels,
    coordinator_name,
    municipality_name,
    totals: {
      channels: channels.length,
      groups,
      canales,
      audience,
      clicks,
      clicks_prev: clicksPrev,
      clicks_delta: clicksDelta,
      clicks_30d: clicks30d,
      people_clicked: peopleClicked,
      views,
      click_rate_pct: audience ? Math.round((clicks / audience) * 1000) / 10 : null,
      watch_rate_pct: audience
        ? Math.round(((views || clicks) / audience) * 1000) / 10
        : null,
    },
  };
}

function listMobilizedContents(db, campaignId, { coordinatorId, municipalityId } = {}) {
  let sql = `
    SELECT * FROM mobilized_contents
    WHERE campaign_id = ? AND status != 'arquivado'
  `;
  const params = [campaignId];
  if (coordinatorId) {
    sql += ' AND coordinator_id = ?';
    params.push(Number(coordinatorId));
  }
  if (municipalityId) {
    sql += ' AND municipality_id = ?';
    params.push(Number(municipalityId));
  }
  sql += ' ORDER BY id DESC';

  const rows = db.prepare(sql).all(...params).map((r) => enrichMobilizedContent(db, r));

  const summary = {
    contents: rows.length,
    channels: rows.reduce((s, r) => s + r.totals.channels, 0),
    groups: rows.reduce((s, r) => s + r.totals.groups, 0),
    canales: rows.reduce((s, r) => s + r.totals.canales, 0),
    audience: rows.reduce((s, r) => s + r.totals.audience, 0),
    clicks: rows.reduce((s, r) => s + r.totals.clicks, 0),
    people_clicked: rows.reduce((s, r) => s + r.totals.people_clicked, 0),
    clicks_30d: rows.reduce((s, r) => s + r.totals.clicks_30d, 0),
    clicks_delta: rows.reduce((s, r) => s + r.totals.clicks_delta, 0),
    views: rows.reduce((s, r) => s + r.totals.views, 0),
    with_territory: rows.filter((r) => r.coordinator_id || r.municipality_id).length,
  };
  summary.click_rate_pct = summary.audience
    ? Math.round((summary.people_clicked / summary.audience) * 1000) / 10
    : null;

  return { items: rows, summary };
}

module.exports = {
  enrichMobilizedContent,
  listMobilizedContents,
};
