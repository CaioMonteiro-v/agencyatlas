/**
 * Integração Bitly Analytics API v4.
 * Sem BITLY_ACCESS_TOKEN, o painel opera com métricas manuais.
 */

function bitlyConfigured() {
  return Boolean(process.env.BITLY_ACCESS_TOKEN);
}

function bitlyStatus() {
  return {
    configured: bitlyConfigured(),
    mode: bitlyConfigured() ? 'live' : 'manual',
    hint: bitlyConfigured()
      ? 'Token Bitly ativo — sincronização de cliques disponível'
      : 'Configure BITLY_ACCESS_TOKEN no ambiente para puxar a análise do Bitly automaticamente. Enquanto isso, atualize os cliques manualmente.',
  };
}

/** Extrai bitlink no formato domain/hash (ex.: bit.ly/FalaFabio). */
function parseBitlink(urlOrPath) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./, '');
    const hash = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!host || !hash) return null;
    return `${host}/${hash}`;
  } catch {
    const cleaned = raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/+$/, '');
    if (!cleaned.includes('/')) return null;
    return cleaned;
  }
}

async function bitlyGet(path) {
  const token = process.env.BITLY_ACCESS_TOKEN;
  const res = await fetch(`https://api-ssl.bitly.com/v4${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.description || body?.message || `Bitly HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Busca total de cliques + série diária (30 dias) de um Bitlink.
 */
async function fetchBitlinkAnalytics(bitlyUrl) {
  if (!bitlyConfigured()) {
    return { ok: false, mode: 'manual', error: 'Bitly API não configurada' };
  }

  const bitlink = parseBitlink(bitlyUrl);
  if (!bitlink) {
    return { ok: false, error: 'Link Bitly inválido' };
  }

  const encoded = encodeURIComponent(bitlink);

  const [summaryAll, summary30, clicks30, bitlinkInfo] = await Promise.all([
    bitlyGet(`/bitlinks/${encoded}/clicks/summary?unit=day&units=-1`),
    bitlyGet(`/bitlinks/${encoded}/clicks/summary?unit=day&units=30`),
    bitlyGet(`/bitlinks/${encoded}/clicks?unit=day&units=30`),
    bitlyGet(`/bitlinks/${encoded}`).catch(() => null),
  ]);

  const series = Array.isArray(clicks30?.link_clicks)
    ? clicks30.link_clicks
      .map((row) => ({
        date: String(row.date || '').slice(0, 10),
        clicks: Math.max(0, Number(row.clicks) || 0),
      }))
      .filter((r) => r.date)
      .reverse()
    : [];

  return {
    ok: true,
    mode: 'live',
    bitlink,
    total_clicks: Math.max(0, Number(summaryAll?.total_clicks) || 0),
    clicks_30d: Math.max(0, Number(summary30?.total_clicks) || 0),
    series,
    destination_url: bitlinkInfo?.long_url || null,
    title: bitlinkInfo?.title || null,
    synced_at: new Date().toISOString(),
  };
}

async function syncMobilizedFromBitly(db, row) {
  const analytics = await fetchBitlinkAnalytics(row.bitly_url);
  if (!analytics.ok) return { row, analytics };

  db.prepare(`
    UPDATE mobilized_contents SET
      clicks = ?,
      clicks_30d = ?,
      clicks_series = ?,
      bitly_synced_at = ?,
      destination_url = COALESCE(?, destination_url)
    WHERE id = ?
  `).run(
    analytics.total_clicks,
    analytics.clicks_30d,
    JSON.stringify(analytics.series),
    analytics.synced_at,
    analytics.destination_url,
    row.id,
  );

  const updated = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(row.id);
  return { row: updated, analytics };
}

module.exports = {
  bitlyConfigured,
  bitlyStatus,
  parseBitlink,
  fetchBitlinkAnalytics,
  syncMobilizedFromBitly,
};
