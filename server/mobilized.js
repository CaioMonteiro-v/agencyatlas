/**
 * Conteúdos mobilizados — análise estilo Bitly + grupos/canais.
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
  const clicks30d = Math.max(0, Number(row.clicks_30d) || 0);
  const views = Math.max(0, Number(row.views) || 0);
  const series = parseSeries(row.clicks_series);
  const peopleClicked = clicks;

  return {
    ...row,
    clicks_series: series,
    channels,
    totals: {
      channels: channels.length,
      groups,
      canales,
      audience,
      clicks,
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

function listMobilizedContents(db, campaignId) {
  const rows = db.prepare(`
    SELECT * FROM mobilized_contents
    WHERE campaign_id = ? AND status != 'arquivado'
    ORDER BY id DESC
  `).all(campaignId).map((r) => enrichMobilizedContent(db, r));

  const summary = {
    contents: rows.length,
    channels: rows.reduce((s, r) => s + r.totals.channels, 0),
    groups: rows.reduce((s, r) => s + r.totals.groups, 0),
    canales: rows.reduce((s, r) => s + r.totals.canales, 0),
    audience: rows.reduce((s, r) => s + r.totals.audience, 0),
    clicks: rows.reduce((s, r) => s + r.totals.clicks, 0),
    people_clicked: rows.reduce((s, r) => s + r.totals.people_clicked, 0),
    clicks_30d: rows.reduce((s, r) => s + r.totals.clicks_30d, 0),
    views: rows.reduce((s, r) => s + r.totals.views, 0),
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
