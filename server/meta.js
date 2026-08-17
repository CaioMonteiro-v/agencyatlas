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
      previous_totals: null,
      engagement: null,
      note: 'Totais da conta Instagram aparecem após a primeira sincronização.',
    };
  }
  const totals = parseIgTotals(cfg.last_ig_totals);
  const previous = parseIgTotals(cfg.prev_ig_totals);
  let engagement = null;
  if (totals && previous) {
    const commentsDelta = (totals.comments || 0) - (previous.comments || 0);
    const likesDelta = (totals.likes || 0) - (previous.likes || 0);
    const reachDelta = (totals.reach || 0) - (previous.reach || 0);
    let label = 'Estável desde a sync anterior';
    let tone = 'stable';
    if (commentsDelta > 0 || likesDelta > 0 || reachDelta > 0) {
      label = 'Engajamento subiu desde a sync anterior';
      tone = 'up';
    } else if (commentsDelta < 0 || likesDelta < 0 || reachDelta < 0) {
      label = 'Engajamento ficou mais baixo que na sync anterior — reforçar dobra do conteúdo';
      tone = 'down';
    }
    engagement = {
      tone,
      label,
      comments_delta: commentsDelta,
      likes_delta: likesDelta,
      reach_delta: reachDelta,
    };
  }
  return {
    last_sync_at: cfg.last_ig_sync_at || null,
    totals,
    previous_totals: previous,
    engagement,
    ig_username: cfg.ig_username || null,
    note: 'Totais da conta (@oficial) são reais. Valores por município são estimativa proporcional às metas — o Instagram não informa de qual cidade veio o comentário.',
  };
}

function saveIgAccountSnapshot(db, campaignId, totals, syncedAt, profile = null) {
  const existing = db.prepare('SELECT * FROM campaign_meta_config WHERE campaign_id = ?').get(campaignId);
  const payload = JSON.stringify({
    comments: Number(totals?.comments) || 0,
    likes: Number(totals?.likes) || 0,
    reach: Number(totals?.reach) || 0,
    posts: Number(totals?.posts) || 0,
    saved: Number(totals?.saved) || 0,
    shares: Number(totals?.shares) || 0,
    followers: Number(totals?.followers || profile?.followers_count) || 0,
  });
  const username = profile?.username || null;
  if (existing) {
    db.prepare(`
      UPDATE campaign_meta_config SET
        prev_ig_totals = last_ig_totals,
        last_ig_sync_at = ?,
        last_ig_totals = ?,
        ig_username = COALESCE(?, ig_username),
        updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ?
    `).run(syncedAt, payload, username, campaignId);
  } else {
    db.prepare(`
      INSERT INTO campaign_meta_config (campaign_id, last_ig_sync_at, last_ig_totals, ig_username)
      VALUES (?, ?, ?, ?)
    `).run(campaignId, syncedAt, payload, username);
  }
}

async function probeMetaToken() {
  if (!metaConfigured()) {
    return {
      ...metaStatus(),
      token_ok: false,
      token_error: 'META_ACCESS_TOKEN / META_IG_USER_ID não configurados',
    };
  }
  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  const igUserId = process.env.META_IG_USER_ID;
  const access = process.env.META_ACCESS_TOKEN;
  try {
    const fields = 'id,username,name,followers_count,follows_count,media_count,profile_picture_url';
    const url = `https://graph.facebook.com/${version}/${igUserId}?fields=${fields}&access_token=${encodeURIComponent(access)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ...metaStatus(),
        token_ok: false,
        token_error: data?.error?.message || `Meta HTTP ${res.status}`,
      };
    }
    return {
      ...metaStatus(),
      token_ok: true,
      ig_username: data.username || null,
      ig_name: data.name || null,
      followers_count: Number(data.followers_count) || null,
      follows_count: Number(data.follows_count) || null,
      media_count: Number(data.media_count) || null,
      profile_picture_url: data.profile_picture_url || null,
      hint: `Meta OK · @${data.username || 'conta'}${data.followers_count != null ? ` · ${Number(data.followers_count).toLocaleString('pt-BR')} seguidores` : ''} — sync liberado. Totais da conta são reais; município é estimativa.`,
    };
  } catch (err) {
    return {
      ...metaStatus(),
      token_ok: false,
      token_error: err.message || 'Falha ao validar token Meta',
    };
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
    'media_product_type',
    'thumbnail_url',
    'media_url',
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
      totals: { comments: 0, reach: 0, likes: 0, posts: 0, saved: 0, shares: 0 },
      profile: null,
    };
  }

  // Perfil da conta (seguidores etc.)
  let profile = null;
  try {
    const profileUrl = `https://graph.facebook.com/${version}/${igUserId}?fields=id,username,name,followers_count,media_count&access_token=${encodeURIComponent(token)}`;
    const pr = await fetch(profileUrl);
    const pdata = await pr.json().catch(() => ({}));
    if (pr.ok) {
      profile = {
        id: pdata.id,
        username: pdata.username || null,
        name: pdata.name || null,
        followers_count: Number(pdata.followers_count) || 0,
        media_count: Number(pdata.media_count) || 0,
      };
    }
  } catch {
    /* ok */
  }

  const media = data.data || [];
  const totals = media.reduce(
    (acc, m) => {
      acc.comments += Number(m.comments_count || 0);
      acc.likes += Number(m.like_count || 0);
      acc.posts += 1;
      return acc;
    },
    { comments: 0, reach: 0, likes: 0, posts: 0, saved: 0, shares: 0 },
  );

  // Insights por mídia (reach/impressions/saved/shares — depende de permissão)
  for (const item of media.slice(0, 12)) {
    try {
      const insightUrl = `https://graph.facebook.com/${version}/${item.id}/insights?metric=reach,impressions,saved,shares&access_token=${encodeURIComponent(token)}`;
      const ir = await fetch(insightUrl);
      const idata = await ir.json().catch(() => ({}));
      if (ir.ok && Array.isArray(idata.data)) {
        for (const metric of idata.data) {
          const val = Number(metric?.values?.[0]?.value || 0);
          if (metric.name === 'reach' || metric.name === 'impressions') {
            totals.reach += val;
            item[metric.name] = val;
          }
          if (metric.name === 'saved') {
            totals.saved += val;
            item.saved = val;
          }
          if (metric.name === 'shares') {
            totals.shares += val;
            item.shares = val;
          }
        }
      }
    } catch (_) {
      /* ignore per-media insight failures */
    }
  }

  if (profile) {
    totals.followers = profile.followers_count;
  }

  return { ok: true, mode: 'live', media, totals, profile };
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
  probeMetaToken,
  fetchInstagramSnapshot,
  distributeIgTotals,
  readIgAccountSnapshot,
  saveIgAccountSnapshot,
};
