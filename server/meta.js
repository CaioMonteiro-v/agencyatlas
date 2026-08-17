/**
 * Integração Meta / Instagram Graph API.
 * Sem META_ACCESS_TOKEN + META_IG_USER_ID, opera em modo manual.
 */

function metaConfigured() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID);
}

function metaStatus() {
  return {
    configured: metaConfigured(),
    ig_user_id: process.env.META_IG_USER_ID || null,
    mode: metaConfigured() ? 'live' : 'manual',
    hint: metaConfigured()
      ? 'Token Meta ativo — sincronização disponível. Totais da conta são reais; números por município são estimativa.'
      : 'Configure META_ACCESS_TOKEN e META_IG_USER_ID no ambiente para puxar Instagram automaticamente. Enquanto isso, use métricas manuais.',
  };
}

function parseIgTotals(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readIgAccountSnapshot(db, campaignId) {
  const cfg = db.prepare('SELECT * FROM campaign_meta_config WHERE campaign_id = ?').get(campaignId);
  if (!cfg) {
    return {
      last_sync_at: null,
      totals: null,
      note: 'Totais da conta Instagram aparecem após a primeira sincronização.',
    };
  }
  return {
    last_sync_at: cfg.last_ig_sync_at || null,
    totals: parseIgTotals(cfg.last_ig_totals),
    ig_username: cfg.ig_username || null,
    note: 'Totais da conta (@oficial) são reais. Valores por município são estimativa proporcional às metas — o Instagram não informa de qual cidade veio o comentário.',
  };
}

function saveIgAccountSnapshot(db, campaignId, totals, syncedAt) {
  const existing = db.prepare('SELECT campaign_id FROM campaign_meta_config WHERE campaign_id = ?').get(campaignId);
  const payload = JSON.stringify({
    comments: Number(totals?.comments) || 0,
    likes: Number(totals?.likes) || 0,
    reach: Number(totals?.reach) || 0,
    posts: Number(totals?.posts) || 0,
  });
  if (existing) {
    db.prepare(`
      UPDATE campaign_meta_config SET
        last_ig_sync_at = ?,
        last_ig_totals = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ?
    `).run(syncedAt, payload, campaignId);
  } else {
    db.prepare(`
      INSERT INTO campaign_meta_config (campaign_id, last_ig_sync_at, last_ig_totals)
      VALUES (?, ?, ?)
    `).run(campaignId, syncedAt, payload);
  }
}

async function fetchInstagramSnapshot() {
  if (!metaConfigured()) {
    return {
      ok: false,
      mode: 'manual',
      error: 'Meta API não configurada',
      media: [],
      totals: { comments: 0, reach: 0, likes: 0, posts: 0 },
    };
  }

  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  const fields = [
    'id',
    'caption',
    'like_count',
    'comments_count',
    'timestamp',
    'permalink',
    'media_type',
  ].join(',');

  const url = `https://graph.facebook.com/${version}/${igUserId}/media?fields=${fields}&limit=25&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      mode: 'live',
      error: data?.error?.message || `Meta API HTTP ${res.status}`,
      media: [],
      totals: { comments: 0, reach: 0, likes: 0, posts: 0 },
    };
  }

  const media = data.data || [];
  const totals = media.reduce(
    (acc, m) => {
      acc.comments += Number(m.comments_count || 0);
      acc.likes += Number(m.like_count || 0);
      acc.posts += 1;
      return acc;
    },
    { comments: 0, reach: 0, likes: 0, posts: 0 },
  );

  // Insights de reach (opcional — pode falhar sem permissão)
  for (const item of media.slice(0, 10)) {
    try {
      const insightUrl = `https://graph.facebook.com/${version}/${item.id}/insights?metric=reach,impressions&access_token=${encodeURIComponent(token)}`;
      const ir = await fetch(insightUrl);
      const idata = await ir.json().catch(() => ({}));
      if (ir.ok && Array.isArray(idata.data)) {
        for (const metric of idata.data) {
          const val = Number(metric?.values?.[0]?.value || 0);
          if (metric.name === 'reach' || metric.name === 'impressions') {
            totals.reach += val;
            item[metric.name] = val;
          }
        }
      }
    } catch (_) {
      /* ignore per-media insight failures */
    }
  }

  return { ok: true, mode: 'live', media, totals };
}

/**
 * Distribui métricas agregadas do IG proporcionalmente à expectativa de views
 * (Instagram não entrega geo municipal nativo sem Ads).
 */
function distributeIgTotals(links, totals) {
  const weightSum = links.reduce((s, l) => s + Math.max(1, Number(l.content_views_expected || 0)), 0);
  if (!links.length) return [];

  return links.map((l) => {
    const weight = Math.max(1, Number(l.content_views_expected || 0));
    const share = weight / weightSum;
    return {
      municipality_id: l.municipality_id,
      coordinator_id: l.coordinator_id,
      ig_comments: Math.round(totals.comments * share),
      ig_reach: Math.round(totals.reach * share),
      content_views_actual: Math.round((totals.reach || totals.likes) * share),
    };
  });
}

module.exports = {
  metaConfigured,
  metaStatus,
  fetchInstagramSnapshot,
  distributeIgTotals,
  readIgAccountSnapshot,
  saveIgAccountSnapshot,
};
