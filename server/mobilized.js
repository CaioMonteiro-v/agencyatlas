/**
 * Conteúdos mobilizados — Bitly + grupos/canais (análise de alcance).
 */

function enrichMobilizedContent(db, row) {
  const channels = db.prepare(`
    SELECT * FROM mobilized_content_channels
    WHERE mobilized_content_id = ?
    ORDER BY members_count DESC, id DESC
  `).all(row.id);

  const audience = channels.reduce((s, c) => s + Math.max(0, Number(c.members_count) || 0), 0);
  const clicks = Math.max(0, Number(row.clicks) || 0);
  const views = Math.max(0, Number(row.views) || 0);
  const watched = views || clicks;

  return {
    ...row,
    channels,
    totals: {
      channels: channels.length,
      audience,
      clicks,
      views,
      watched,
      click_rate_pct: audience ? Math.round((clicks / audience) * 1000) / 10 : null,
      watch_rate_pct: audience ? Math.round((watched / audience) * 1000) / 10 : null,
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
    audience: rows.reduce((s, r) => s + r.totals.audience, 0),
    clicks: rows.reduce((s, r) => s + r.totals.clicks, 0),
    views: rows.reduce((s, r) => s + r.totals.views, 0),
  };
  summary.watch_rate_pct = summary.audience
    ? Math.round(((summary.views || summary.clicks) / summary.audience) * 1000) / 10
    : null;

  return { items: rows, summary };
}

module.exports = {
  enrichMobilizedContent,
  listMobilizedContents,
};
