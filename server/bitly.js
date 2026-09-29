/**
 * Integração Bitly API v4 — criação + analytics.
 * Sem BITLY_ACCESS_TOKEN o painel roda em modo manual (cola bitlink pronto).
 * Com token: criar em massa, sync de cliques, território pronto.
 *
 * Env opcionais (além de BITLY_ACCESS_TOKEN):
 *   BITLY_DOMAIN      — domínio branded (ex.: bit.ly ou seu domínio Bitly)
 *   BITLY_GROUP_GUID  — group_guid da org/workspace Bitly
 */

function bitlyConfigured() {
  return Boolean(String(process.env.BITLY_ACCESS_TOKEN || '').trim());
}

function token() {
  return String(process.env.BITLY_ACCESS_TOKEN || '').trim();
}

function bitlyDomain() {
  const d = String(process.env.BITLY_DOMAIN || '').trim();
  return d || null;
}

function bitlyGroupGuid() {
  const g = String(process.env.BITLY_GROUP_GUID || '').trim();
  return g || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bitlyStatus(extra = {}) {
  const configured = bitlyConfigured();
  return {
    configured,
    mode: configured ? 'live' : 'manual',
    ready: configured && extra.token_ok !== false,
    token_ok: extra.token_ok,
    token_error: extra.token_error || null,
    domain: bitlyDomain(),
    group_guid: bitlyGroupGuid() ? 'set' : null,
    hint: configured
      ? (extra.token_ok === false
        ? `Token Bitly inválido/expirado: ${extra.token_error || 'verifique no Bitly'}`
        : 'Token Bitly pronto — criar links em massa e sync de cliques liberados.')
      : 'Cole BITLY_ACCESS_TOKEN no Render e faça deploy. Até lá, dá para cadastrar bitlinks já prontos manualmente.',
    ...extra,
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

function friendlyBitlyError(err) {
  const status = err?.status;
  const msg = err?.message || 'Erro Bitly';
  const bodyMsg = err?.body?.description || err?.body?.message || '';
  const combined = `${msg} ${bodyMsg}`.toLowerCase();
  if (status === 401 || status === 403) {
    return 'Token Bitly sem permissão (gere um token com escopo bitly.default / genérico).';
  }
  if (status === 402 || combined.includes('upgrade') || combined.includes('plan')) {
    return 'Plano Bitly não permite criar links via API — use Core/Premium ou cole bitlinks manuais.';
  }
  if (status === 429) {
    return 'Limite de taxa Bitly — aguarde alguns segundos e tente de novo.';
  }
  if (combined.includes('already') || combined.includes('duplicate')) {
    return 'Esse destino já tem bitlink nesta conta Bitly (use o link existente ou outro destino).';
  }
  return bodyMsg || msg;
}

async function bitlyGet(path) {
  const res = await fetch(`https://api-ssl.bitly.com/v4${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
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

async function bitlyPost(path, payload) {
  const res = await fetch(`https://api-ssl.bitly.com/v4${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

/** Valida o token (GET /user). Não quebra o app se falhar. */
async function probeBitlyToken() {
  if (!bitlyConfigured()) {
    return bitlyStatus({ token_ok: false, token_error: 'Token não configurado' });
  }
  try {
    const user = await bitlyGet('/user');
    let defaultGroup = bitlyGroupGuid();
    if (!defaultGroup && Array.isArray(user?.default_group_guid)) {
      defaultGroup = user.default_group_guid;
    } else if (!defaultGroup && user?.default_group_guid) {
      defaultGroup = user.default_group_guid;
    }
    return bitlyStatus({
      token_ok: true,
      login: user?.login || null,
      is_active: user?.is_active !== false,
      default_group_guid: defaultGroup || null,
    });
  } catch (err) {
    return bitlyStatus({
      token_ok: false,
      token_error: friendlyBitlyError(err),
    });
  }
}

/**
 * Cria um bitlink a partir da URL longa (requer plano Bitly com create).
 * options: title, tags, domain, group_guid, custom_bitlink (hash only, e.g. FalaFabio)
 */
async function createBitlink(longUrl, {
  title,
  tags,
  domain,
  group_guid: groupGuid,
  custom_bitlink: customBitlink,
} = {}) {
  if (!bitlyConfigured()) {
    const err = new Error('Configure BITLY_ACCESS_TOKEN no Render para criar links');
    err.status = 503;
    throw err;
  }
  const url = String(longUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    const err = new Error('URL de destino inválida (use https://...)');
    err.status = 400;
    throw err;
  }

  const payload = { long_url: url };
  const domainToUse = domain || bitlyDomain();
  const groupToUse = groupGuid || bitlyGroupGuid();
  if (domainToUse) payload.domain = domainToUse;
  if (groupToUse) payload.group_guid = groupToUse;
  if (title) payload.title = String(title).slice(0, 120);
  if (Array.isArray(tags) && tags.length) {
    payload.tags = tags.map((t) => String(t).slice(0, 50)).slice(0, 10);
  }

  try {
    let created;
    const custom = customBitlink ? String(customBitlink).replace(/^\/+/, '').trim() : '';
    if (custom && domainToUse) {
      // Bitly branded custom path: POST /custom_bitlinks after creating, or bitlinks with custom
      created = await bitlyPost('/bitlinks', {
        ...payload,
      });
      try {
        const bitlinkId = created.id;
        const customPayload = {
          custom_bitlink: `${domainToUse}/${custom}`,
          bitlink_id: bitlinkId,
        };
        const customRes = await bitlyPost('/custom_bitlinks', customPayload);
        const link = customRes?.custom_bitlink
          ? (customRes.custom_bitlink.startsWith('http')
            ? customRes.custom_bitlink
            : `https://${customRes.custom_bitlink}`)
          : (created?.link || null);
        return {
          bitly_url: link,
          bitlink: customRes?.custom_bitlink || created.id || parseBitlink(link),
          destination_url: created.long_url || url,
          title: created.title || title || null,
          custom: true,
        };
      } catch {
        // Custom falhou — devolve o bitlink padrão criado
      }
    } else {
      created = await bitlyPost('/bitlinks', payload);
    }

    const link = created?.link || (created?.id ? `https://${created.id}` : null);
    if (!link) {
      const err = new Error('Bitly não retornou o link encurtado');
      err.status = 502;
      throw err;
    }

    return {
      bitly_url: link,
      bitlink: created.id || parseBitlink(link),
      destination_url: created.long_url || url,
      title: created.title || title || null,
      custom: false,
    };
  } catch (err) {
    const nice = new Error(friendlyBitlyError(err));
    nice.status = err.status || 502;
    nice.body = err.body;
    throw nice;
  }
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

  try {
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
      tags: Array.isArray(bitlinkInfo?.tags) ? bitlinkInfo.tags : [],
      synced_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      mode: 'live',
      error: friendlyBitlyError(err),
      status: err.status,
    };
  }
}

async function syncMobilizedFromBitly(db, row) {
  const analytics = await fetchBitlinkAnalytics(row.bitly_url);
  if (!analytics.ok) {
    try {
      db.prepare(`
        UPDATE mobilized_contents SET bitly_last_error = ? WHERE id = ?
      `).run(String(analytics.error || 'erro').slice(0, 280), row.id);
    } catch {
      /* coluna pode não existir ainda em instâncias antigas — migrate cuida */
    }
    return { row, analytics };
  }

  const prevClicks = Math.max(0, Number(row.clicks) || 0);
  db.prepare(`
    UPDATE mobilized_contents SET
      clicks = ?,
      clicks_prev = ?,
      clicks_30d = ?,
      clicks_series = ?,
      bitly_synced_at = ?,
      bitly_last_error = NULL,
      destination_url = COALESCE(?, destination_url)
    WHERE id = ?
  `).run(
    analytics.total_clicks,
    prevClicks,
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
  probeBitlyToken,
  parseBitlink,
  fetchBitlinkAnalytics,
  syncMobilizedFromBitly,
  createBitlink,
  sleep,
  friendlyBitlyError,
};
