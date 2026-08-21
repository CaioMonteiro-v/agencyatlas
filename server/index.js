const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');
const { getDb } = require('./db');
const { seedProduction, seedDemo } = require('./seed');
const {
  buildCoordinatorDetail,
  buildCampaignReport,
  getThresholds,
} = require('./analytics');
const { metaStatus, probeMetaToken, fetchInstagramSnapshot, distributeIgTotals, readIgAccountSnapshot, saveIgAccountSnapshot } = require('./meta');
const { runAssistant } = require('./assistant');
const { login, register, listUsers, requireAuth, authConfigured, canSelfRegister, inviteRequiredForSignup, hasTeamUsers, setAuthDb, TEAM_USER, extractToken, verifyToken } = require('./auth');
const { listContentWeek, buildContentDetail } = require('./content');
const { listMobilizedContents, enrichMobilizedContent } = require('./mobilized');
const { bitlyStatus, probeBitlyToken, syncMobilizedFromBitly, createBitlink, bitlyConfigured, sleep: bitlySleep } = require('./bitly');
const {
  listDemands,
  demandCountsByMunicipality,
  demandSummary,
  createDemand,
  updateDemand,
} = require('./demands');
const {
  CATEGORIES: INVESTMENT_CATEGORIES,
  listInvestments,
  buildDossier,
  buildSummary: buildInvestmentSummary,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  getInvestment,
  upsertMunicipalityNote,
  importDossier,
  clearDossier,
  loadOfficialDossierSeed,
  parsePlainTextDossier,
} = require('./investment');
const { parseDocxFiles } = require('./docx-dossier');
const {
  listGroups: listDobraGroups,
  buildSummary: buildDobraSummary,
  getGroup: getDobraGroup,
  createGroup: createDobraGroup,
  updateGroup: updateDobraGroup,
  deleteGroup: deleteDobraGroup,
  syncGroupBitly,
  syncAllGroupBitly,
} = require('./dobra-groups');
const supabaseStorage = require('./supabase-storage');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '40mb' }));
app.use('/logos', express.static(path.join(__dirname, '../public/logos')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(requireAuth);

let db;

function getCampaignBySlug(slug) {
  return db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(slug);
}

/** Coordenada perto do centro do município (para o mapa de calor). */
function geoNearMunicipality(muni) {
  if (!muni || muni.lat == null || muni.lng == null) {
    return { lat: null, lng: null };
  }
  return {
    lat: Number(muni.lat) + (Math.random() - 0.5) * 0.06,
    lng: Number(muni.lng) + (Math.random() - 0.5) * 0.06,
  };
}

/** Funil do mapa: coordenador (território/evento de coord.) ou mobilizador (evento/código pessoal). */
function funnelFromEventRole(role) {
  return role === 'coordinator' ? 'coordenador' : 'mobilizador';
}

function leaderScoreSql() {
  return `
    SELECT
      l.*,
      m.name AS municipality_name,
      COALESCE(COUNT(r.id), 0) AS registrations_count,
      COALESCE(l.mission_bonus, 0) AS mission_bonus,
      (COALESCE(COUNT(r.id), 0) + COALESCE(l.mission_bonus, 0)) AS score
    FROM leaders l
    LEFT JOIN municipalities m ON m.id = l.municipality_id
    LEFT JOIN registrations r ON r.leader_id = l.id
    WHERE l.campaign_id = ?
    GROUP BY l.id
    ORDER BY score DESC, l.name ASC
  `;
}

/* ---------- Agency / Dashboard ---------- */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'atlas-agency',
    database: db?.dialect || (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ? 'postgres' : 'sqlite'),
    storage: supabaseStorage.status(),
    auth: authConfigured(),
    bitly: bitlyStatus(),
    meta: metaStatus(),
  });
});

app.post('/api/auth/login', (req, res) => {
  const result = login(req.body.username, req.body.password);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/auth/register', (req, res) => {
  const actor = verifyToken(extractToken(req));
  const result = register({
    name: req.body.name,
    username: req.body.username,
    password: req.body.password,
    invite_code: req.body.invite_code,
  }, actor);
  if (!result.ok) return res.status(400).json(result);
  res.status(201).json(result);
});

app.get('/api/auth/status', (_req, res) => {
  res.json({
    auth_configured: authConfigured(),
    can_register: canSelfRegister(),
    needs_first_user: !hasTeamUsers(),
    invite_required: inviteRequiredForSignup(),
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = verifyToken(extractToken(req));
  if (!user) {
    return res.json({
      authenticated: false,
      auth_configured: authConfigured(),
      can_register: canSelfRegister(),
    });
  }
  res.json({ authenticated: true, user });
});

app.get('/api/auth/users', (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas admin pode listar usuários' });
  }
  res.json(listUsers());
});

app.get('/api/agency/summary', (_req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM campaigns WHERE status = 'ativa') AS active_campaigns,
      (SELECT COUNT(*) FROM leaders) AS leaders,
      (SELECT COUNT(*) FROM registrations) AS registrations,
      (SELECT COUNT(*) FROM events) AS events,
      (SELECT COUNT(*) FROM missions WHERE status = 'ativa') AS active_missions
  `).get();

  const campaignStats = campaigns.map((c) => {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM leaders WHERE campaign_id = ?) AS leaders,
        (SELECT COUNT(*) FROM registrations WHERE campaign_id = ?) AS registrations,
        (SELECT COUNT(*) FROM events WHERE campaign_id = ?) AS events,
        (SELECT COUNT(*) FROM missions WHERE campaign_id = ? AND status = 'ativa') AS missions
    `).get(c.id, c.id, c.id, c.id);
    return { ...c, stats };
  });

  res.json({ totals, campaigns: campaignStats });
});

/* ---------- Campaigns ---------- */
app.get('/api/campaigns', (_req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(campaigns);
});

app.get('/api/campaigns/:slug', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM leaders WHERE campaign_id = ?) AS leaders,
      (SELECT COUNT(*) FROM leaders WHERE campaign_id = ? AND status = 'ativo') AS active_leaders,
      (SELECT COUNT(*) FROM registrations WHERE campaign_id = ?) AS registrations,
      (SELECT COUNT(DISTINCT municipality_id) FROM registrations WHERE campaign_id = ?) AS municipalities_reached,
      (SELECT COUNT(*) FROM events WHERE campaign_id = ?) AS events,
      (SELECT COUNT(*) FROM missions WHERE campaign_id = ?) AS missions
  `).get(campaign.id, campaign.id, campaign.id, campaign.id, campaign.id, campaign.id);

  const recent = db.prepare(`
    SELECT r.*, l.name AS leader_name, m.name AS municipality_name
    FROM registrations r
    LEFT JOIN leaders l ON l.id = r.leader_id
    LEFT JOIN municipalities m ON m.id = r.municipality_id
    WHERE r.campaign_id = ?
    ORDER BY r.created_at DESC
    LIMIT 8
  `).all(campaign.id);

  res.json({ ...campaign, stats, recent_registrations: recent });
});

/** Dados públicos mínimos — sem ranking, cadastros ou painel */
app.get('/api/campaigns/:slug/public', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  res.json({
    slug: campaign.slug,
    name: campaign.name,
    candidate: campaign.candidate,
    logo_url: campaign.logo_url,
    accent_color: campaign.accent_color,
    whatsapp_url: campaign.whatsapp_url,
  });
});

app.post('/api/campaigns', (req, res) => {
  const { name, candidate, description, mission, accent_color, whatsapp_url, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const slug = (req.body.slug || name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  try {
    const result = db.prepare(`
      INSERT INTO campaigns (slug, name, candidate, description, mission, status, accent_color, logo_url, whatsapp_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slug,
      name,
      candidate || name,
      description || '',
      mission || '',
      status || 'ativa',
      accent_color || '#7BA3B8',
      '/logos/atlas-agency.png',
      whatsapp_url || 'https://bit.ly/FalaFabio'
    );
    const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível criar a campanha', detail: err.message });
  }
});

/* ---------- Heatmap / Municipalities ---------- */
app.get('/api/campaigns/:slug/heatmap', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const funnelRaw = String(req.query.funnel || '').trim().toLowerCase();
  const funnel = funnelRaw === 'coordenador' || funnelRaw === 'mobilizador' ? funnelRaw : null;

  const points = funnel
    ? db.prepare(`
        SELECT lat, lng, funnel FROM registrations
        WHERE campaign_id = ?
          AND lat IS NOT NULL AND lng IS NOT NULL
          AND funnel = ?
      `).all(campaign.id, funnel)
    : db.prepare(`
        SELECT lat, lng, funnel FROM registrations
        WHERE campaign_id = ? AND lat IS NOT NULL AND lng IS NOT NULL
      `).all(campaign.id);

  const municipalities = funnel
    ? db.prepare(`
        SELECT
          m.*,
          COALESCE(COUNT(DISTINCT r.id), 0) AS registrations_count,
          COALESCE((
            SELECT COUNT(*) FROM leaders l
            WHERE l.municipality_id = m.id AND l.campaign_id = ?
          ), 0) AS leaders_count
        FROM municipalities m
        LEFT JOIN registrations r
          ON r.municipality_id = m.id
          AND r.campaign_id = ?
          AND r.funnel = ?
        GROUP BY m.id
        ORDER BY registrations_count DESC, m.name ASC
      `).all(campaign.id, campaign.id, funnel)
    : db.prepare(`
        SELECT
          m.*,
          COALESCE(COUNT(DISTINCT r.id), 0) AS registrations_count,
          COALESCE((
            SELECT COUNT(*) FROM leaders l
            WHERE l.municipality_id = m.id AND l.campaign_id = ?
          ), 0) AS leaders_count
        FROM municipalities m
        LEFT JOIN registrations r ON r.municipality_id = m.id AND r.campaign_id = ?
        GROUP BY m.id
        ORDER BY registrations_count DESC, m.name ASC
      `).all(campaign.id, campaign.id);

  const funnelTotals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN funnel = 'coordenador' THEN 1 ELSE 0 END), 0) AS coordenador,
      COALESCE(SUM(CASE WHEN funnel = 'mobilizador' THEN 1 ELSE 0 END), 0) AS mobilizador,
      COUNT(*) AS total
    FROM registrations
    WHERE campaign_id = ?
      AND lat IS NOT NULL AND lng IS NOT NULL
  `).get(campaign.id);

  res.json({
    points,
    municipalities,
    funnel: funnel || 'todos',
    funnel_totals: {
      coordenador: Number(funnelTotals?.coordenador) || 0,
      mobilizador: Number(funnelTotals?.mobilizador) || 0,
      total: Number(funnelTotals?.total) || 0,
    },
  });
});

app.get('/api/campaigns/:slug/municipalities/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const municipality = db.prepare('SELECT * FROM municipalities WHERE id = ?').get(req.params.id);
  if (!municipality) return res.status(404).json({ error: 'Município não encontrado' });

  const leaders = db.prepare(`
    SELECT
      l.*,
      COALESCE(COUNT(r.id), 0) AS registrations_count,
      (COALESCE(COUNT(r.id), 0) + COALESCE(l.mission_bonus, 0)) AS score
    FROM leaders l
    LEFT JOIN registrations r ON r.leader_id = l.id
    WHERE l.campaign_id = ? AND l.municipality_id = ?
    GROUP BY l.id
    ORDER BY score DESC
  `).all(campaign.id, municipality.id);

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM registrations
    WHERE campaign_id = ? AND municipality_id = ?
  `).get(campaign.id, municipality.id).c;

  const ranked = leaders.map((l, idx) => ({
    ...l,
    activity_label: idx === 0 && l.registrations_count > 0
      ? 'mais ativo'
      : l.status === 'inativo'
        ? 'menos ativo'
        : l.registrations_count === 0
          ? 'menos ativo'
          : 'ativo',
  }));

  res.json({
    municipality,
    coordinator: municipality.coordinator_name,
    registrations_count: total,
    leaders: ranked,
  });
});

/* ---------- Ranking / Leaders ---------- */
app.get('/api/campaigns/:slug/ranking', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const type = req.query.type;
  let rows = db.prepare(leaderScoreSql()).all(campaign.id);
  if (type === 'politica' || type === 'multiplicador') {
    rows = rows.filter((r) => r.type === type);
  }

  res.json({
    updated_at: new Date().toISOString(),
    ranking: rows.map((r, i) => ({ ...r, position: i + 1 })),
  });
});

app.get('/api/campaigns/:slug/leaders', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const rows = db.prepare(leaderScoreSql()).all(campaign.id);
  res.json(rows);
});

app.get('/api/campaigns/:slug/leaders/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const leader = db.prepare(`
    SELECT l.*, m.name AS municipality_name
    FROM leaders l
    LEFT JOIN municipalities m ON m.id = l.municipality_id
    WHERE l.id = ? AND l.campaign_id = ?
  `).get(req.params.id, campaign.id);

  if (!leader) return res.status(404).json({ error: 'Liderança não encontrada' });

  const count = db.prepare('SELECT COUNT(*) AS c FROM registrations WHERE leader_id = ?').get(leader.id).c;
  const recent = db.prepare(`
    SELECT * FROM registrations WHERE leader_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(leader.id);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const trackPath = `/r/${campaign.slug}/${leader.referral_code}`;

  res.json({
    ...leader,
    registrations_count: count,
    recent_registrations: recent,
    parameterized_link: `${baseUrl.replace(':3001', ':5173')}${trackPath}`,
    link_path: trackPath,
  });
});

app.post('/api/campaigns/:slug/leaders', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const { name, type, municipality_id, phone, status } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  if (!['politica', 'multiplicador'].includes(type)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  const code = nano();
  const result = db.prepare(`
    INSERT INTO leaders (campaign_id, municipality_id, name, type, status, referral_code, phone, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaign.id,
    municipality_id || null,
    name,
    type,
    status || 'ativo',
    code,
    phone || null,
    req.body.bio || null
  );

  const created = db.prepare('SELECT * FROM leaders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

/* ---------- Parameterized links ---------- */
app.get('/api/campaigns/:slug/links', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const leaders = db.prepare(leaderScoreSql()).all(campaign.id);
  const origin = req.query.origin || '';

  res.json(leaders.map((l) => ({
    leader_id: l.id,
    name: l.name,
    type: l.type,
    referral_code: l.referral_code,
    status: l.status,
    registrations_count: l.registrations_count,
    link_path: `/r/${campaign.slug}/${l.referral_code}`,
    full_link: origin ? `${origin}/r/${campaign.slug}/${l.referral_code}` : `/r/${campaign.slug}/${l.referral_code}`,
  })));
});

/* ---------- Registrations ---------- */
app.get('/api/campaigns/:slug/registrations', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '25', 10));
  const offset = (page - 1) * limit;
  const q = (req.query.q || '').trim();

  let where = 'WHERE r.campaign_id = ?';
  const params = [campaign.id];
  if (q) {
    where += ` AND (
      r.full_name LIKE ? OR r.phone LIKE ? OR r.referral_code LIKE ?
      OR l.name LIKE ? OR r.organizer_name LIKE ? OR r.mobilizer_name LIKE ?
    )`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  const total = db.prepare(`
    SELECT COUNT(*) AS c
    FROM registrations r
    LEFT JOIN leaders l ON l.id = r.leader_id
    ${where}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT
      r.*,
      l.name AS leader_name,
      l.type AS leader_type,
      m.name AS municipality_name,
      COALESCE(NULLIF(r.mobilizer_name, ''), l.name) AS mobilizer_display,
      CASE
        WHEN r.mobilizer_name IS NOT NULL AND TRIM(r.mobilizer_name) != '' THEN (
          SELECT COUNT(*) FROM registrations r2
          WHERE r2.campaign_id = r.campaign_id
            AND r2.mobilizer_name = r.mobilizer_name
        )
        WHEN r.leader_id IS NOT NULL THEN (
          SELECT COUNT(*) FROM registrations r2 WHERE r2.leader_id = r.leader_id
        )
        ELSE 0
      END AS mobilizer_total
    FROM registrations r
    LEFT JOIN leaders l ON l.id = r.leader_id
    LEFT JOIN municipalities m ON m.id = r.municipality_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ total, page, limit, items: rows });
});

app.get('/api/campaigns/:slug/backup', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const payload = {
    exported_at: new Date().toISOString(),
    campaign,
    coordinators: db.prepare('SELECT * FROM coordinators WHERE campaign_id = ?').all(campaign.id),
    coordinator_municipalities: db.prepare(`
      SELECT cm.* FROM coordinator_municipalities cm
      JOIN coordinators c ON c.id = cm.coordinator_id
      WHERE c.campaign_id = ?
    `).all(campaign.id),
    leaders: db.prepare('SELECT * FROM leaders WHERE campaign_id = ?').all(campaign.id),
    mobilizers: db.prepare('SELECT * FROM mobilizers WHERE campaign_id = ?').all(campaign.id),
    registrations: db.prepare('SELECT * FROM registrations WHERE campaign_id = ?').all(campaign.id),
    events: db.prepare('SELECT * FROM events WHERE campaign_id = ?').all(campaign.id),
    event_registrations: db.prepare(`
      SELECT er.* FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      WHERE e.campaign_id = ?
    `).all(campaign.id),
    missions: db.prepare('SELECT * FROM missions WHERE campaign_id = ?').all(campaign.id),
    content_posts: db.prepare('SELECT * FROM content_posts WHERE campaign_id = ?').all(campaign.id),
    content_assignments: db.prepare(`
      SELECT ca.* FROM content_assignments ca
      JOIN content_posts cp ON cp.id = ca.content_post_id
      WHERE cp.campaign_id = ?
    `).all(campaign.id),
    mobilized_contents: db.prepare('SELECT * FROM mobilized_contents WHERE campaign_id = ?').all(campaign.id),
    mobilized_content_channels: db.prepare(`
      SELECT ch.* FROM mobilized_content_channels ch
      JOIN mobilized_contents mc ON mc.id = ch.mobilized_content_id
      WHERE mc.campaign_id = ?
    `).all(campaign.id),
    territory_demands: db.prepare('SELECT * FROM territory_demands WHERE campaign_id = ?').all(campaign.id),
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="atlas-backup-${campaign.slug}-${Date.now()}.json"`,
  );
  res.send(JSON.stringify(payload, null, 2));
});

app.post('/api/campaigns/:slug/registrations', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const { full_name, phone, email, referral_code } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  let leader = null;
  if (referral_code) {
    leader = db.prepare('SELECT * FROM leaders WHERE referral_code = ? AND campaign_id = ?').get(referral_code, campaign.id);
  }

  const muni = leader?.municipality_id
    ? db.prepare('SELECT * FROM municipalities WHERE id = ?').get(leader.municipality_id)
    : null;

  const result = db.prepare(`
    INSERT INTO registrations (
      campaign_id, leader_id, municipality_id, full_name, phone, email,
      source, referral_code, lat, lng, mobilizer_name, funnel
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaign.id,
    leader?.id || null,
    leader?.municipality_id || null,
    full_name,
    phone,
    email || null,
    referral_code ? `link/${referral_code}` : 'direto',
    referral_code || null,
    muni ? muni.lat + (Math.random() - 0.5) * 0.06 : null,
    muni ? muni.lng + (Math.random() - 0.5) * 0.06 : null,
    leader?.name || null,
    leader ? 'coordenador' : null,
  );

  res.status(201).json(db.prepare('SELECT * FROM registrations WHERE id = ?').get(result.lastInsertRowid));
});

/* ---------- Events + QR ---------- */
app.get('/api/campaigns/:slug/events', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const events = db.prepare(`
    SELECT e.*,
      m.name AS municipality_name,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS attendees
    FROM events e
    LEFT JOIN municipalities m ON m.id = e.municipality_id
    WHERE e.campaign_id = ?
    ORDER BY e.event_date ASC
  `).all(campaign.id);

  res.json(events);
});

app.post('/api/campaigns/:slug/events', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const {
    name,
    description,
    location,
    event_date,
    event_time,
    organizer_name,
    organizer_role,
    coordinator_id,
    channel_link,
    channel_name,
    municipality_id,
  } = req.body;
  if (!name || !event_date) return res.status(400).json({ error: 'Nome e data são obrigatórios' });

  const role = organizer_role === 'coordinator' ? 'coordinator' : 'mobilizer';
  let resolvedName = organizer_name ? String(organizer_name).trim() : '';
  let resolvedCoordinatorId = null;

  if (role === 'coordinator') {
    const cid = Number(coordinator_id);
    if (!cid) {
      return res.status(400).json({ error: 'Selecione um coordenador cadastrado' });
    }
    const coord = db.prepare(
      'SELECT id, name FROM coordinators WHERE id = ? AND campaign_id = ?'
    ).get(cid, campaign.id);
    if (!coord) {
      return res.status(400).json({ error: 'Coordenador não encontrado nesta campanha' });
    }
    resolvedCoordinatorId = coord.id;
    resolvedName = coord.name;
  } else if (!resolvedName) {
    return res.status(400).json({ error: 'Informe o nome do mobilizador' });
  }

  let resolvedMuniId = municipality_id ? Number(municipality_id) : null;
  if (resolvedMuniId) {
    const muni = db.prepare('SELECT id FROM municipalities WHERE id = ?').get(resolvedMuniId);
    if (!muni) return res.status(400).json({ error: 'Município inválido' });
  } else {
    return res.status(400).json({ error: 'Selecione o município do evento (para o mapa de calor)' });
  }

  const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nano().slice(0, 4)}`;
  const channelLink = channel_link ? String(channel_link).trim() : null;
  const channelName = channel_name ? String(channel_name).trim() : null;

  const muniRow = db.prepare('SELECT * FROM municipalities WHERE id = ?').get(resolvedMuniId);
  const locationText = location || muniRow?.name || '';

  const result = db.prepare(`
    INSERT INTO events (
      campaign_id, name, description, location, event_date, event_time,
      slug, organizer_name, organizer_role, coordinator_id, channel_link, channel_name, municipality_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaign.id,
    name,
    description || '',
    locationText,
    event_date,
    event_time || '',
    slug,
    resolvedName,
    role,
    resolvedCoordinatorId,
    channelLink || null,
    channelName || null,
    resolvedMuniId,
  );

  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid));
});

app.patch('/api/campaigns/:slug/events/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const event = db.prepare(
    'SELECT * FROM events WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const name = req.body.name != null ? String(req.body.name).trim() : event.name;
  if (!name) return res.status(400).json({ error: 'Nome inválido' });

  let role = event.organizer_role || 'mobilizer';
  let resolvedName = event.organizer_name || '';
  let resolvedCoordinatorId = event.coordinator_id || null;

  if (req.body.organizer_role != null || req.body.organizer_name != null || req.body.coordinator_id != null) {
    role = req.body.organizer_role === 'coordinator' ? 'coordinator' : 'mobilizer';
    resolvedName = req.body.organizer_name != null
      ? String(req.body.organizer_name).trim()
      : (event.organizer_name || '');
    resolvedCoordinatorId = null;

    if (role === 'coordinator') {
      const cid = Number(req.body.coordinator_id != null ? req.body.coordinator_id : event.coordinator_id);
      if (!cid) return res.status(400).json({ error: 'Selecione um coordenador cadastrado' });
      const coord = db.prepare(
        'SELECT id, name FROM coordinators WHERE id = ? AND campaign_id = ?'
      ).get(cid, campaign.id);
      if (!coord) return res.status(400).json({ error: 'Coordenador não encontrado nesta campanha' });
      resolvedCoordinatorId = coord.id;
      resolvedName = coord.name;
    } else if (!resolvedName) {
      return res.status(400).json({ error: 'Informe o nome do mobilizador' });
    }
  }

  const channelLink = req.body.channel_link !== undefined
    ? (req.body.channel_link ? String(req.body.channel_link).trim() : null)
    : event.channel_link;
  const channelName = req.body.channel_name !== undefined
    ? (req.body.channel_name ? String(req.body.channel_name).trim() : null)
    : event.channel_name;

  let resolvedMuniId = event.municipality_id || null;
  if (req.body.municipality_id !== undefined) {
    resolvedMuniId = req.body.municipality_id ? Number(req.body.municipality_id) : null;
    if (resolvedMuniId) {
      const muni = db.prepare('SELECT id FROM municipalities WHERE id = ?').get(resolvedMuniId);
      if (!muni) return res.status(400).json({ error: 'Município inválido' });
    }
  }

  db.prepare(`
    UPDATE events SET
      name = ?,
      description = ?,
      location = ?,
      event_date = ?,
      event_time = ?,
      organizer_name = ?,
      organizer_role = ?,
      coordinator_id = ?,
      channel_link = ?,
      channel_name = ?,
      municipality_id = ?
    WHERE id = ?
  `).run(
    name,
    req.body.description !== undefined ? (req.body.description || '') : event.description,
    req.body.location !== undefined ? (req.body.location || '') : event.location,
    req.body.event_date !== undefined ? req.body.event_date : event.event_date,
    req.body.event_time !== undefined ? (req.body.event_time || '') : event.event_time,
    resolvedName,
    role,
    resolvedCoordinatorId,
    channelLink || null,
    channelName || null,
    resolvedMuniId,
    event.id,
  );

  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id));
});

app.get('/api/events/:slug', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, c.name AS campaign_name, c.slug AS campaign_slug, c.whatsapp_url, c.accent_color,
      m.name AS municipality_name
    FROM events e
    JOIN campaigns c ON c.id = e.campaign_id
    LEFT JOIN municipalities m ON m.id = e.municipality_id
    WHERE e.slug = ?
  `).get(req.params.slug);

  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
  res.json(event);
});

app.get('/api/events/:slug/qrcode', async (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const envOrigin = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  const queryOrigin = (req.query.origin || '').replace(/\/$/, '');
  const hostOrigin = `${req.protocol}://${req.get('host')}`.replace(':3001', ':5173');
  const origin = queryOrigin || envOrigin || hostOrigin;
  const url = `${origin}/evento/${event.slug}`;

  try {
    const size = Math.min(2048, Math.max(320, parseInt(req.query.size || '1024', 10) || 1024));
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#2C3E3A', light: '#FFFFFF' },
    });
    res.json({
      url,
      qrcode: dataUrl,
      event,
      warning: /localhost|127\.0\.0\.1/.test(origin)
        ? 'URL local: QR não funciona em outro celular. Defina PUBLIC_APP_URL ou a URL pública no painel.'
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar QR Code', detail: err.message });
  }
});

app.post('/api/events/:slug/registrations', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const { full_name, email, phone, connect_whatsapp, organizer_name } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Nome completo é obrigatório' });
  if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório' });

  // Mobilizador = quem fechou o evento com a campanha (vem do evento)
  const mobilizer = event.organizer_name ? String(event.organizer_name).trim() : null;
  // Organiz./Coord. = critério do município (texto livre no formulário público)
  const organizer = organizer_name ? String(organizer_name).trim() : null;
  const funnel = funnelFromEventRole(event.organizer_role);
  const muni = event.municipality_id
    ? db.prepare('SELECT * FROM municipalities WHERE id = ?').get(event.municipality_id)
    : null;
  const geo = geoNearMunicipality(muni);

  const result = db.prepare(`
    INSERT INTO event_registrations (event_id, full_name, email, phone, connect_whatsapp, organizer_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(event.id, full_name, email || null, phone || null, connect_whatsapp ? 1 : 0, organizer);

  // Também entra no Registro de Cadastros da campanha (origem = evento) + mapa de calor
  const reg = db.prepare(`
    INSERT INTO registrations (
      campaign_id, leader_id, municipality_id, full_name, phone, email,
      source, referral_code, lat, lng, organizer_name, mobilizer_name, funnel
    )
    VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(
    event.campaign_id,
    muni?.id || null,
    full_name,
    phone,
    email || null,
    `evento/${event.slug}`,
    geo.lat,
    geo.lng,
    organizer,
    mobilizer,
    funnel,
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    registration_id: reg.lastInsertRowid,
    ok: true,
    organizer_name: organizer,
    mobilizer_name: mobilizer,
  });
});

app.get('/api/campaigns/:slug/events/:eventId/attendees', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const event = db.prepare('SELECT * FROM events WHERE id = ? AND campaign_id = ?').get(req.params.eventId, campaign.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const attendees = db.prepare(`
    SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at DESC
  `).all(event.id);

  res.json({ event, attendees });
});

app.get('/api/campaigns/:slug/events/:eventId/radar', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const event = db.prepare('SELECT * FROM events WHERE id = ? AND campaign_id = ?')
    .get(req.params.eventId, campaign.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN connect_whatsapp = 1 THEN 1 ELSE 0 END), 0) AS whatsapp_clicks
    FROM event_registrations
    WHERE event_id = ?
  `).get(event.id);

  const recent = db.prepare(`
    SELECT id, full_name, phone, organizer_name, connect_whatsapp, created_at
    FROM event_registrations
    WHERE event_id = ?
    ORDER BY created_at DESC
    LIMIT 40
  `).all(event.id);

  const cutoff = Date.now() - 2 * 60 * 1000;
  const recentPace = recent.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;

  res.json({
    event,
    total: Number(stats.total) || 0,
    whatsapp_clicks: Number(stats.whatsapp_clicks) || 0,
    recent_pace: recentPace,
    recent,
    generated_at: new Date().toISOString(),
  });
});

function slugifyMobilizerCode(name, fallback = '') {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 28);
  return base || fallback || nano().slice(0, 6);
}

function mobilizerStats(campaignId, mobilizerId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM registrations
    WHERE campaign_id = ? AND mobilizer_id = ?
  `).get(campaignId, mobilizerId);
  return Number(row?.c) || 0;
}

/* ---------- Mobilizadores (código pessoal) ---------- */
app.get('/api/campaigns/:slug/mobilizers', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const rows = db.prepare(`
    SELECT * FROM mobilizers WHERE campaign_id = ? ORDER BY name ASC
  `).all(campaign.id);

  res.json(rows.map((m) => ({
    ...m,
    registrations: mobilizerStats(campaign.id, m.id),
    link_path: `/m/${campaign.slug}/${m.code}`,
  })));
});

app.post('/api/campaigns/:slug/mobilizers', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome do mobilizador é obrigatório' });

  let code = slugifyMobilizerCode(req.body.code || name);
  const exists = db.prepare(
    'SELECT id FROM mobilizers WHERE campaign_id = ? AND code = ?'
  ).get(campaign.id, code);
  if (exists) code = `${code}-${nano().slice(0, 3)}`;

  const result = db.prepare(`
    INSERT INTO mobilizers (campaign_id, name, code, phone, notes, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(
    campaign.id,
    name,
    code,
    req.body.phone || null,
    req.body.notes || null,
  );

  const mobilizer = db.prepare('SELECT * FROM mobilizers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...mobilizer,
    registrations: 0,
    link_path: `/m/${campaign.slug}/${mobilizer.code}`,
  });
});

app.patch('/api/campaigns/:slug/mobilizers/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const mobilizer = db.prepare(
    'SELECT * FROM mobilizers WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!mobilizer) return res.status(404).json({ error: 'Mobilizador não encontrado' });

  const name = req.body.name != null ? String(req.body.name).trim() : mobilizer.name;
  if (!name) return res.status(400).json({ error: 'Nome inválido' });

  let code = mobilizer.code;
  if (req.body.code != null) {
    code = slugifyMobilizerCode(req.body.code, mobilizer.code);
    const clash = db.prepare(
      'SELECT id FROM mobilizers WHERE campaign_id = ? AND code = ? AND id != ?'
    ).get(campaign.id, code, mobilizer.id);
    if (clash) return res.status(400).json({ error: 'Código já em uso' });
  }

  const phone = req.body.phone !== undefined ? (req.body.phone || null) : mobilizer.phone;
  const notes = req.body.notes !== undefined ? (req.body.notes || null) : mobilizer.notes;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : mobilizer.active;

  db.prepare(`
    UPDATE mobilizers SET name = ?, code = ?, phone = ?, notes = ?, active = ? WHERE id = ?
  `).run(name, code, phone, notes, active, mobilizer.id);

  // Mantém nome na Base quando o mobilizador é renomeado
  if (name !== mobilizer.name) {
    db.prepare(`
      UPDATE registrations SET mobilizer_name = ? WHERE mobilizer_id = ?
    `).run(name, mobilizer.id);
  }

  const updated = db.prepare('SELECT * FROM mobilizers WHERE id = ?').get(mobilizer.id);
  res.json({
    ...updated,
    registrations: mobilizerStats(campaign.id, updated.id),
    link_path: `/m/${campaign.slug}/${updated.code}`,
  });
});

app.delete('/api/campaigns/:slug/mobilizers/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const mobilizer = db.prepare(
    'SELECT * FROM mobilizers WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!mobilizer) return res.status(404).json({ error: 'Mobilizador não encontrado' });

  db.prepare('DELETE FROM mobilizers WHERE id = ?').run(mobilizer.id);
  res.json({ ok: true });
});

app.get('/api/m/:slug/:code', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const mobilizer = db.prepare(`
    SELECT * FROM mobilizers
    WHERE campaign_id = ? AND code = ? AND active = 1
  `).get(campaign.id, String(req.params.code || '').toLowerCase());

  if (!mobilizer) return res.status(404).json({ error: 'Link de mobilizador inválido' });

  res.json({
    campaign: {
      slug: campaign.slug,
      name: campaign.name,
      candidate: campaign.candidate,
      logo_url: campaign.logo_url,
      accent_color: campaign.accent_color,
      whatsapp_url: campaign.whatsapp_url,
    },
    mobilizer: {
      id: mobilizer.id,
      name: mobilizer.name,
      code: mobilizer.code,
    },
  });
});

app.post('/api/m/:slug/:code/registrations', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const mobilizer = db.prepare(`
    SELECT * FROM mobilizers
    WHERE campaign_id = ? AND code = ? AND active = 1
  `).get(campaign.id, String(req.params.code || '').toLowerCase());
  if (!mobilizer) return res.status(404).json({ error: 'Link de mobilizador inválido' });

  const { full_name, phone, email, organizer_name } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  const organizer = organizer_name ? String(organizer_name).trim() : null;

  const result = db.prepare(`
    INSERT INTO registrations (
      campaign_id, leader_id, municipality_id, full_name, phone, email,
      source, referral_code, lat, lng, organizer_name, mobilizer_name, mobilizer_id, funnel
    )
    VALUES (?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)
  `).run(
    campaign.id,
    full_name,
    phone,
    email || null,
    `mobilizador/${mobilizer.code}`,
    organizer,
    mobilizer.name,
    mobilizer.id,
    'mobilizador',
  );

  res.status(201).json({
    ok: true,
    id: result.lastInsertRowid,
    mobilizer_name: mobilizer.name,
    whatsapp_url: campaign.whatsapp_url,
  });
});

/* ---------- Missions ---------- */
app.get('/api/campaigns/:slug/missions', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const missions = db.prepare(`
    SELECT mi.*, m.name AS municipality_name
    FROM missions mi
    LEFT JOIN municipalities m ON m.id = mi.municipality_id
    WHERE mi.campaign_id = ?
    ORDER BY mi.created_at DESC
  `).all(campaign.id);

  const withAssignments = missions.map((mission) => {
    const assignments = db.prepare(`
      SELECT ma.*, l.name AS leader_name, l.type AS leader_type, l.photo_url
      FROM mission_assignments ma
      JOIN leaders l ON l.id = ma.leader_id
      WHERE ma.mission_id = ?
      ORDER BY ma.contribution DESC
    `).all(mission.id);
    return { ...mission, assignments, percent: Math.min(100, Math.round((mission.progress / mission.target) * 100)) };
  });

  res.json(withAssignments);
});

app.post('/api/campaigns/:slug/missions', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const { title, description, target, municipality_id, leader_ids } = req.body;
  if (!title || !target) return res.status(400).json({ error: 'Título e meta são obrigatórios' });

  const result = db.prepare(`
    INSERT INTO missions (campaign_id, title, description, target, municipality_id, status)
    VALUES (?, ?, ?, ?, ?, 'ativa')
  `).run(campaign.id, title, description || '', target, municipality_id || null);

  const missionId = result.lastInsertRowid;
  if (Array.isArray(leader_ids)) {
    const insert = db.prepare('INSERT INTO mission_assignments (mission_id, leader_id, contribution) VALUES (?, ?, 0)');
    for (const lid of leader_ids) insert.run(missionId, lid);
  }

  res.status(201).json(db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId));
});

app.patch('/api/campaigns/:slug/missions/:id/progress', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const mission = db.prepare('SELECT * FROM missions WHERE id = ? AND campaign_id = ?').get(req.params.id, campaign.id);
  if (!mission) return res.status(404).json({ error: 'Missão não encontrada' });

  const progress = Math.max(0, parseInt(req.body.progress ?? mission.progress, 10));
  const status = progress >= mission.target ? 'concluida' : (req.body.status || mission.status);

  db.prepare('UPDATE missions SET progress = ?, status = ? WHERE id = ?').run(progress, status, mission.id);

  if (status === 'concluida' && mission.status !== 'concluida') {
    const assigns = db.prepare('SELECT leader_id, contribution FROM mission_assignments WHERE mission_id = ?').all(mission.id);
    const bump = db.prepare('UPDATE leaders SET mission_bonus = mission_bonus + ? WHERE id = ?');
    for (const a of assigns) {
      bump.run(Math.max(5, Math.round(a.contribution / 2) + 10), a.leader_id);
    }
  }

  res.json(db.prepare('SELECT * FROM missions WHERE id = ?').get(mission.id));
});

/* ---------- Coordinators ---------- */
function normalizeCoordType(raw) {
  const t = String(raw || 'regional').trim().toLowerCase();
  if (t === 'dobra' || t === 'mobilizacao' || t === 'mobilização') return 'dobra';
  return 'regional';
}

function setCoordinatorMunicipalities(campaignId, coordinatorId, municipalityIds) {
  const coord = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(coordinatorId, campaignId);
  if (!coord) return null;

  const isDobra = normalizeCoordType(coord.coord_type) === 'dobra';
  const ids = [...new Set((municipalityIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const prev = db.prepare('SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?')
    .all(coordinatorId);

  const prevMetrics = {};
  for (const p of prev) {
    const row = db.prepare(`
      SELECT vote_expectation, content_views_expected, content_views_actual, ig_comments, ig_reach, last_meta_sync
      FROM coordinator_municipalities WHERE coordinator_id = ? AND municipality_id = ?
    `).get(coordinatorId, p.municipality_id);
    if (row) prevMetrics[p.municipality_id] = row;
  }

  db.transaction(() => {
    for (const p of prev) {
      const m = db.prepare('SELECT coordinator_name FROM municipalities WHERE id = ?').get(p.municipality_id);
      if (m && m.coordinator_name === coord.name) {
        db.prepare('UPDATE municipalities SET coordinator_name = NULL WHERE id = ?').run(p.municipality_id);
      }
    }

    db.prepare('DELETE FROM coordinator_municipalities WHERE coordinator_id = ?').run(coordinatorId);

    for (const mid of ids) {
      const exists = db.prepare('SELECT id FROM municipalities WHERE id = ?').get(mid);
      if (!exists) continue;

      // Regionais: município exclusivo. Dobra (ex. Cuiabá): pode compartilhar com regional.
      if (!isDobra) {
        const others = db.prepare(`
          SELECT cm.coordinator_id
          FROM coordinator_municipalities cm
          JOIN coordinators c ON c.id = cm.coordinator_id
          WHERE cm.municipality_id = ? AND c.campaign_id = ? AND cm.coordinator_id != ?
        `).all(mid, campaignId, coordinatorId);

        for (const o of others) {
          db.prepare('DELETE FROM coordinator_municipalities WHERE coordinator_id = ? AND municipality_id = ?')
            .run(o.coordinator_id, mid);
        }
      }

      const keep = prevMetrics[mid] || {};
      db.prepare(`
        INSERT INTO coordinator_municipalities (
          coordinator_id, municipality_id,
          vote_expectation, content_views_expected, content_views_actual,
          ig_comments, ig_reach, last_meta_sync
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        coordinatorId,
        mid,
        keep.vote_expectation || 0,
        keep.content_views_expected || 0,
        keep.content_views_actual || 0,
        keep.ig_comments || 0,
        keep.ig_reach || 0,
        keep.last_meta_sync || null,
      );
      // Nome “oficial” do município fica com o regional
      if (!isDobra) {
        db.prepare('UPDATE municipalities SET coordinator_name = ? WHERE id = ?').run(coord.name, mid);
      }
    }
  })();

  return coord;
}

function detailFor(campaign, coordinator) {
  return buildCoordinatorDetail(db, campaign, coordinator, getThresholds(db, campaign.id));
}

app.get('/api/campaigns/:slug/coordinators', async (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const rows = db.prepare(`
    SELECT * FROM coordinators WHERE campaign_id = ? ORDER BY name ASC
  `).all(campaign.id);

  const coordinators = rows.map((c) => detailFor(campaign, c));
  const summary = {
    total: coordinators.length,
    regional: coordinators.filter((c) => normalizeCoordType(c.coord_type) === 'regional').length,
    dobra: coordinators.filter((c) => normalizeCoordType(c.coord_type) === 'dobra').length,
    municipalities_assigned: coordinators.reduce((s, c) => s + c.totals.municipalities, 0),
    registrations: coordinators.reduce((s, c) => s + c.totals.registrations, 0),
    vote_expectation: coordinators.reduce((s, c) => s + c.totals.vote_expectation, 0),
    content_views_expected: coordinators.reduce((s, c) => s + c.totals.content_views_expected, 0),
    content_views_actual: coordinators.reduce((s, c) => s + c.totals.content_views_actual, 0),
    ig_comments: coordinators.reduce((s, c) => s + c.totals.ig_comments, 0),
    with_failures: coordinators.filter((c) => c.health.status === 'critical').length,
    alarms: coordinators.reduce((s, c) => s + c.totals.alarms, 0),
  };
  summary.vote_progress_pct = summary.vote_expectation
    ? Math.round((summary.registrations / summary.vote_expectation) * 1000) / 10
    : null;
  summary.content_progress_pct = summary.content_views_expected
    ? Math.round((summary.content_views_actual / summary.content_views_expected) * 1000) / 10
    : null;

  res.json({
    coordinators,
    summary,
    meta: await probeMetaToken(),
    ig_account: readIgAccountSnapshot(db, campaign.id),
  });
});

app.get('/api/campaigns/:slug/coordinators/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(req.params.id, campaign.id);
  if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

  res.json(detailFor(campaign, coordinator));
});

app.post('/api/campaigns/:slug/coordinators', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const { name, phone, photo_url, notes, municipality_ids, coord_type } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome do coordenador é obrigatório' });
    }

    const type = normalizeCoordType(coord_type);
    const result = db.prepare(`
      INSERT INTO coordinators (campaign_id, name, phone, photo_url, notes, coord_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      campaign.id,
      String(name).trim(),
      phone || null,
      photo_url || null,
      notes || null,
      type,
    );

    const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(result.lastInsertRowid);
    if (Array.isArray(municipality_ids) && municipality_ids.length) {
      setCoordinatorMunicipalities(campaign.id, coordinator.id, municipality_ids);
    }

    res.status(201).json(detailFor(campaign, coordinator));
  } catch (err) {
    console.error('POST coordinators:', err);
    res.status(500).json({ error: err.message || 'Erro ao cadastrar coordenador' });
  }
});

app.patch('/api/campaigns/:slug/coordinators/:id', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
      .get(req.params.id, campaign.id);
    if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

    const name = req.body.name != null ? String(req.body.name).trim() : coordinator.name;
    if (!name) return res.status(400).json({ error: 'Nome inválido' });

    const phone = req.body.phone !== undefined ? (req.body.phone || null) : coordinator.phone;
    const photo_url = req.body.photo_url !== undefined ? (req.body.photo_url || null) : coordinator.photo_url;
    const notes = req.body.notes !== undefined ? (req.body.notes || null) : coordinator.notes;
    const type = req.body.coord_type !== undefined
      ? normalizeCoordType(req.body.coord_type)
      : normalizeCoordType(coordinator.coord_type);

    db.prepare(`
      UPDATE coordinators SET name = ?, phone = ?, photo_url = ?, notes = ?, coord_type = ? WHERE id = ?
    `).run(name, phone, photo_url, notes, type, coordinator.id);

    if (name !== coordinator.name) {
      db.prepare(`
        UPDATE municipalities SET coordinator_name = ?
        WHERE id IN (
          SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?
        )
        AND COALESCE(coordinator_name, '') = ?
      `).run(name, coordinator.id, coordinator.name);
    }

    if (Array.isArray(req.body.municipality_ids)) {
      setCoordinatorMunicipalities(campaign.id, coordinator.id, req.body.municipality_ids);
    }

    const updated = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(coordinator.id);
    res.json(detailFor(campaign, updated));
  } catch (err) {
    console.error('PATCH coordinators:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar coordenador' });
  }
});

app.put('/api/campaigns/:slug/coordinators/:id/municipalities', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
      .get(req.params.id, campaign.id);
    if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

    const ok = setCoordinatorMunicipalities(campaign.id, coordinator.id, req.body.municipality_ids || []);
    if (!ok) return res.status(404).json({ error: 'Coordenador não encontrado' });

    const updated = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(coordinator.id);
    res.json(detailFor(campaign, updated));
  } catch (err) {
    console.error('PUT coordinator municipalities:', err);
    res.status(500).json({ error: err.message || 'Erro ao vincular municípios' });
  }
});

app.patch('/api/campaigns/:slug/coordinators/:id/municipalities/:muniId/metrics', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(req.params.id, campaign.id);
  if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

  const link = db.prepare(`
    SELECT * FROM coordinator_municipalities
    WHERE coordinator_id = ? AND municipality_id = ?
  `).get(coordinator.id, req.params.muniId);
  if (!link) return res.status(404).json({ error: 'Município não vinculado a este coordenador' });

  const vote_expectation = req.body.vote_expectation !== undefined
    ? Math.max(0, Number(req.body.vote_expectation) || 0)
    : link.vote_expectation;
  const content_views_expected = req.body.content_views_expected !== undefined
    ? Math.max(0, Number(req.body.content_views_expected) || 0)
    : link.content_views_expected;
  const content_views_actual = req.body.content_views_actual !== undefined
    ? Math.max(0, Number(req.body.content_views_actual) || 0)
    : link.content_views_actual;
  const ig_comments = req.body.ig_comments !== undefined
    ? Math.max(0, Number(req.body.ig_comments) || 0)
    : link.ig_comments;
  const ig_reach = req.body.ig_reach !== undefined
    ? Math.max(0, Number(req.body.ig_reach) || 0)
    : link.ig_reach;

  db.prepare(`
    UPDATE coordinator_municipalities SET
      vote_expectation = ?,
      content_views_expected = ?,
      content_views_actual = ?,
      ig_comments = ?,
      ig_reach = ?
    WHERE coordinator_id = ? AND municipality_id = ?
  `).run(
    vote_expectation,
    content_views_expected,
    content_views_actual,
    ig_comments,
    ig_reach,
    coordinator.id,
    req.params.muniId,
  );

  res.json(detailFor(campaign, coordinator));
});

app.delete('/api/campaigns/:slug/coordinators/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(req.params.id, campaign.id);
  if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

  setCoordinatorMunicipalities(campaign.id, coordinator.id, []);
  db.prepare('DELETE FROM coordinators WHERE id = ?').run(coordinator.id);
  res.json({ ok: true });
});

/* ---------- Relatório + Meta + Assistente ---------- */
app.get('/api/campaigns/:slug/report', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  res.json({ ...buildCampaignReport(db, campaign), meta: metaStatus() });
});

app.post('/api/campaigns/:slug/assistant', async (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  try {
    const report = buildCampaignReport(db, campaign);
    const briefing = await runAssistant(report);
    res.json({
      generated_at: new Date().toISOString(),
      ...briefing,
      report_summary: report.summary,
      alarms_count: report.alarms.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Falha na assistente' });
  }
});

/* ---------- Funil de demandas (coordenador → município) ---------- */
app.get('/api/campaigns/:slug/demands', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const items = listDemands(db, {
      campaignId: campaign.id,
      coordinatorId: req.query.coordinator_id,
      municipalityId: req.query.municipality_id,
      status: req.query.status,
    });
    res.json({
      items,
      summary: demandSummary(db, campaign.id),
    });
  } catch (err) {
    console.error('GET demands:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar demandas' });
  }
});

app.get('/api/campaigns/:slug/demands/tree', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const coordinators = db.prepare(`
      SELECT * FROM coordinators WHERE campaign_id = ? ORDER BY name ASC
    `).all(campaign.id);

    const tree = coordinators.map((coord) => {
      const munis = db.prepare(`
        SELECT m.id, m.name
        FROM coordinator_municipalities cm
        JOIN municipalities m ON m.id = cm.municipality_id
        WHERE cm.coordinator_id = ?
        ORDER BY m.name ASC
      `).all(coord.id);

      const counts = demandCountsByMunicipality(db, campaign.id, coord.id);
      const byMuni = Object.fromEntries(counts.map((c) => [c.municipality_id, c]));

      const municipalities = munis.map((m) => ({
        ...m,
        demands_total: Number(byMuni[m.id]?.total) || 0,
        demands_standby: Number(byMuni[m.id]?.standby) || 0,
        demands_resolvido: Number(byMuni[m.id]?.resolvido) || 0,
      }));

      return {
        id: coord.id,
        name: coord.name,
        phone: coord.phone,
        municipalities,
        demands_total: municipalities.reduce((s, m) => s + m.demands_total, 0),
        demands_standby: municipalities.reduce((s, m) => s + m.demands_standby, 0),
        demands_resolvido: municipalities.reduce((s, m) => s + m.demands_resolvido, 0),
      };
    });

    res.json({
      coordinators: tree,
      summary: demandSummary(db, campaign.id),
    });
  } catch (err) {
    console.error('GET demands tree:', err);
    res.status(500).json({ error: err.message || 'Erro ao montar funil' });
  }
});

app.post('/api/campaigns/:slug/demands', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const coordinatorId = Number(req.body.coordinator_id);
    const municipalityId = Number(req.body.municipality_id);
    const description = String(req.body.description || '').trim();
    if (!coordinatorId) return res.status(400).json({ error: 'Selecione o coordenador' });
    if (!municipalityId) return res.status(400).json({ error: 'Selecione o município' });
    if (!description) return res.status(400).json({ error: 'Descreva o que houve' });

    const coord = db.prepare(
      'SELECT id FROM coordinators WHERE id = ? AND campaign_id = ?'
    ).get(coordinatorId, campaign.id);
    if (!coord) return res.status(400).json({ error: 'Coordenador inválido' });

    const link = db.prepare(`
      SELECT 1 FROM coordinator_municipalities
      WHERE coordinator_id = ? AND municipality_id = ?
    `).get(coordinatorId, municipalityId);
    if (!link) return res.status(400).json({ error: 'Município não vinculado a este coordenador' });

    const created = await createDemand(db, {
      campaign_id: campaign.id,
      coordinator_id: coordinatorId,
      municipality_id: municipalityId,
      title: req.body.title ? String(req.body.title).trim() : null,
      description,
      occurred_at: req.body.occurred_at || new Date().toISOString().slice(0, 10),
      unresolved_reason: req.body.unresolved_reason || null,
      created_by: req.user?.name || req.user?.username || null,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('POST demands:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao criar demanda' });
  }
});

app.patch('/api/campaigns/:slug/demands/:id', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const demand = db.prepare(
      'SELECT * FROM territory_demands WHERE id = ? AND campaign_id = ?'
    ).get(req.params.id, campaign.id);
    if (!demand) return res.status(404).json({ error: 'Demanda não encontrada' });

    if (req.body.status === 'resolvido' && !String(req.body.resolution_notes || demand.resolution_notes || '').trim()) {
      // OK button can resolve without notes, but encourage optional notes - allow empty
    }
    if (req.body.status === 'standby' && req.body.unresolved_reason !== undefined) {
      if (!String(req.body.unresolved_reason || '').trim() && demand.status === 'standby') {
        /* allow clearing */
      }
    }

    const updated = await updateDemand(db, demand.id, {
      title: req.body.title,
      description: req.body.description,
      occurred_at: req.body.occurred_at,
      status: req.body.status,
      unresolved_reason: req.body.unresolved_reason,
      resolution_notes: req.body.resolution_notes,
      add_attachments: Array.isArray(req.body.add_attachments) ? req.body.add_attachments : [],
    });

    res.json(updated);
  } catch (err) {
    console.error('PATCH demands:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao atualizar demanda' });
  }
});

app.delete('/api/campaigns/:slug/demands/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const demand = db.prepare(
    'SELECT * FROM territory_demands WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!demand) return res.status(404).json({ error: 'Demanda não encontrada' });
  db.prepare('DELETE FROM territory_demands WHERE id = ?').run(demand.id);
  res.json({ ok: true });
});

/* ---------- Dossiê de investimento por município ---------- */
app.get('/api/campaigns/:slug/investments', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const dossier = buildDossier(db, campaign.id, {
      coordinatorId: req.query.coordinator_id || null,
    });
    res.json({
      ...dossier,
      summary: buildInvestmentSummary(dossier.items || []),
      categories: INVESTMENT_CATEGORIES,
      campaign: {
        slug: campaign.slug,
        name: campaign.name,
        candidate: campaign.candidate,
        logo_url: campaign.logo_url,
      },
    });
  } catch (err) {
    console.error('GET investments:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar dossiê de investimentos' });
  }
});

app.post('/api/campaigns/:slug/investments', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const row = createInvestment(db, campaign.id, req.body || {});
    res.status(201).json({ item: row, dossier: buildDossier(db, campaign.id) });
  } catch (err) {
    console.error('POST investments:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao lançar investimento' });
  }
});

/** Cola o texto/JSON/HTML do dossiê e o sistema monta o relatório */
app.post('/api/campaigns/:slug/investments/import', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    let source = req.body?.text ?? req.body?.source ?? req.body?.municipios ?? null;
    if (req.body?.use_official_seed) {
      source = loadOfficialDossierSeed();
    }
    if (source == null || source === '') {
      return res.status(400).json({
        error: 'Cole o texto do dossiê ou envie use_official_seed: true',
      });
    }

    const merge = Boolean(req.body?.merge);
    const result = importDossier(db, campaign.id, source, { merge });
    res.status(201).json(result);
  } catch (err) {
    console.error('POST investments import:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Erro ao importar dossiê',
      missing: err.missing || undefined,
      detail: err.detail || undefined,
    });
  }
});

/**
 * Upload de um ou vários Word (.docx) — um arquivo por município (ou vários no mesmo).
 * Body JSON: { files: [{ name, content_base64 }], merge?: true }
 * merge=true (padrão): só atualiza os municípios dos arquivos; não apaga o resto.
 */
app.post('/api/campaigns/:slug/investments/import-docx', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) {
      return res.status(400).json({
        error: 'Envie files: [{ name: "Alto Araguaia.docx", content_base64: "..." }]',
      });
    }
    if (files.length > 40) {
      return res.status(400).json({ error: 'Máximo 40 arquivos por vez' });
    }

    const { municipios, files: fileResults } = await parseDocxFiles(files, {
      parsePlainText: parsePlainTextDossier,
    });

    if (!municipios.length) {
      return res.status(400).json({
        error: 'Nenhum município/itens reconhecidos nos Word. Confira categorias e valores em R$.',
        files: fileResults,
      });
    }

    const merge = req.body?.merge !== false; // padrão: mesclar
    const result = importDossier(db, campaign.id, municipios, { merge });
    res.status(201).json({
      ...result,
      files: fileResults,
    });
  } catch (err) {
    console.error('POST investments import-docx:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Erro ao importar Word',
      missing: err.missing || undefined,
      files: err.files || undefined,
    });
  }
});

/** Zera o dossiê inteiro ou só os municípios de um coordenador */
app.post('/api/campaigns/:slug/investments/clear', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    let coordinatorId = req.body?.coordinator_id ? Number(req.body.coordinator_id) : null;

    // Atalho: zerar pelo nome (ex.: Valmir)
    if (!coordinatorId && req.body?.coordinator_name) {
      const name = String(req.body.coordinator_name).trim();
      const row = db.prepare(`
        SELECT id FROM coordinators
        WHERE campaign_id = ? AND LOWER(name) LIKE LOWER(?)
        ORDER BY name ASC
        LIMIT 1
      `).get(campaign.id, `%${name}%`);
      if (!row) {
        return res.status(404).json({ error: `Coordenador não encontrado: ${name}` });
      }
      coordinatorId = row.id;
    }

    const result = clearDossier(db, campaign.id, { coordinatorId });
    res.json(result);
  } catch (err) {
    console.error('POST investments clear:', err);
    res.status(500).json({ error: err.message || 'Erro ao zerar dossiê' });
  }
});

app.patch('/api/campaigns/:slug/investments/:id', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const updated = updateInvestment(db, campaign.id, Number(req.params.id), req.body || {});
    if (!updated) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ item: updated, dossier: buildDossier(db, campaign.id) });
  } catch (err) {
    console.error('PATCH investments:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao atualizar item' });
  }
});

app.delete('/api/campaigns/:slug/investments/:id', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const ok = deleteInvestment(db, campaign.id, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ ok: true, dossier: buildDossier(db, campaign.id) });
  } catch (err) {
    console.error('DELETE investments:', err);
    res.status(500).json({ error: err.message || 'Erro ao remover item' });
  }
});

app.put('/api/campaigns/:slug/investments/municipality-note', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const municipalityId = Number(req.body.municipality_id);
    if (!municipalityId) return res.status(400).json({ error: 'municipality_id obrigatório' });
    upsertMunicipalityNote(
      db,
      campaign.id,
      municipalityId,
      req.body.footnote,
      req.body.sort_order,
    );
    res.json({ ok: true, dossier: buildDossier(db, campaign.id) });
  } catch (err) {
    console.error('PUT investment muni note:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar nota do município' });
  }
});

app.get('/api/campaigns/:slug/investments/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const row = getInvestment(db, campaign.id, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Item não encontrado' });
  res.json(row);
});

/** Grupos WhatsApp criados via dobra — controle + Bitly + foto */
app.get('/api/campaigns/:slug/groups', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const groups = listDobraGroups(db, campaign.id, {
      coordinatorId: req.query.coordinator_id,
      municipalityId: req.query.municipality_id,
      status: req.query.status,
      q: req.query.q,
    });
    res.json({
      groups,
      summary: buildDobraSummary(groups),
      bitly_configured: bitlyConfigured(),
      campaign: { id: campaign.id, slug: campaign.slug, name: campaign.name, candidate: campaign.candidate },
    });
  } catch (err) {
    console.error('GET groups:', err);
    res.status(500).json({ error: err.message || 'Erro ao listar grupos' });
  }
});

app.post('/api/campaigns/:slug/groups', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const result = await createDobraGroup(db, campaign.id, req.body || {});
    const groups = listDobraGroups(db, campaign.id);
    res.status(201).json({
      ...result,
      groups,
      summary: buildDobraSummary(groups),
    });
  } catch (err) {
    console.error('POST groups:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao criar grupo' });
  }
});

app.patch('/api/campaigns/:slug/groups/:id', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const group = await updateDobraGroup(db, campaign.id, Number(req.params.id), req.body || {});
    const groups = listDobraGroups(db, campaign.id);
    res.json({ group, groups, summary: buildDobraSummary(groups) });
  } catch (err) {
    console.error('PATCH groups:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao atualizar grupo' });
  }
});

app.delete('/api/campaigns/:slug/groups/:id', (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const result = deleteDobraGroup(db, campaign.id, Number(req.params.id));
    const groups = listDobraGroups(db, campaign.id);
    res.json({ ...result, groups, summary: buildDobraSummary(groups) });
  } catch (err) {
    console.error('DELETE groups:', err);
    res.status(500).json({ error: err.message || 'Erro ao remover grupo' });
  }
});

app.post('/api/campaigns/:slug/groups/:id/sync', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const group = await syncGroupBitly(db, campaign.id, Number(req.params.id));
    res.json({ group, summary: buildDobraSummary(listDobraGroups(db, campaign.id)) });
  } catch (err) {
    console.error('POST groups sync:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao sincronizar Bitly' });
  }
});

app.post('/api/campaigns/:slug/groups/sync', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const result = await syncAllGroupBitly(db, campaign.id);
    res.json(result);
  } catch (err) {
    console.error('POST groups sync all:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao sincronizar Bitlys' });
  }
});

app.get('/api/campaigns/:slug/meta/status', async (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const cfg = db.prepare('SELECT * FROM campaign_meta_config WHERE campaign_id = ?').get(campaign.id);
  const probed = await probeMetaToken();
  res.json({
    ...probed,
    config: cfg || null,
    ig_account: readIgAccountSnapshot(db, campaign.id),
  });
});

/* ---------- Conteúdo da semana ---------- */
app.get('/api/campaigns/:slug/content', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const week = listContentWeek(db, campaign.id);
    const probed = await probeMetaToken();
    res.json({
      ...week,
      meta: probed,
      ig_account: readIgAccountSnapshot(db, campaign.id),
    });
  } catch (err) {
    console.error('GET content:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar conteúdo' });
  }
});

app.post('/api/campaigns/:slug/content', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Título do conteúdo é obrigatório' });

  const result = db.prepare(`
    INSERT INTO content_posts (
      campaign_id, title, caption, permalink, posted_at, source,
      likes, comments, reach, status
    ) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, 'ativa')
  `).run(
    campaign.id,
    title,
    req.body.caption || '',
    req.body.permalink || null,
    req.body.posted_at || new Date().toISOString().slice(0, 10),
    Math.max(0, Number(req.body.likes) || 0),
    Math.max(0, Number(req.body.comments) || 0),
    Math.max(0, Number(req.body.reach) || 0),
  );

  const post = db.prepare('SELECT * FROM content_posts WHERE id = ?').get(result.lastInsertRowid);

  // Atribuições opcionais na criação
  const assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];
  const insertA = db.prepare(`
    INSERT INTO content_assignments (
      content_post_id, coordinator_id, municipality_id,
      target_views, actual_views, target_comments, actual_comments, status, notes
    ) VALUES (?, ?, ?, ?, 0, ?, 0, 'pendente', ?)
  `);
  for (const a of assignments) {
    if (!a.coordinator_id) continue;
    insertA.run(
      post.id,
      Number(a.coordinator_id),
      a.municipality_id ? Number(a.municipality_id) : null,
      Math.max(0, Number(a.target_views) || 0),
      Math.max(0, Number(a.target_comments) || 0),
      a.notes || null,
    );
  }

  // Atalho: cobrar todos os municípios de um coordenador
  if (req.body.assign_all_for_coordinator_id) {
    const cid = Number(req.body.assign_all_for_coordinator_id);
    const target = Math.max(0, Number(req.body.default_target_views) || 500);
    const munis = db.prepare(`
      SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?
    `).all(cid);
    for (const m of munis) {
      insertA.run(post.id, cid, m.municipality_id, target, 0, null);
    }
  }

  res.status(201).json(buildContentDetail(db, post));
});

app.patch('/api/campaigns/:slug/content/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const post = db.prepare(
    'SELECT * FROM content_posts WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!post) return res.status(404).json({ error: 'Conteúdo não encontrado' });

  const title = req.body.title != null ? String(req.body.title).trim() : post.title;
  if (!title) return res.status(400).json({ error: 'Título inválido' });

  db.prepare(`
    UPDATE content_posts SET
      title = ?, caption = ?, permalink = ?, posted_at = ?,
      likes = ?, comments = ?, reach = ?, status = ?
    WHERE id = ?
  `).run(
    title,
    req.body.caption !== undefined ? req.body.caption : post.caption,
    req.body.permalink !== undefined ? req.body.permalink : post.permalink,
    req.body.posted_at !== undefined ? req.body.posted_at : post.posted_at,
    req.body.likes !== undefined ? Math.max(0, Number(req.body.likes) || 0) : post.likes,
    req.body.comments !== undefined ? Math.max(0, Number(req.body.comments) || 0) : post.comments,
    req.body.reach !== undefined ? Math.max(0, Number(req.body.reach) || 0) : post.reach,
    req.body.status || post.status,
    post.id,
  );

  const updated = db.prepare('SELECT * FROM content_posts WHERE id = ?').get(post.id);
  res.json(buildContentDetail(db, updated));
});

app.post('/api/campaigns/:slug/content/:id/assignments', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const post = db.prepare(
    'SELECT * FROM content_posts WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!post) return res.status(404).json({ error: 'Conteúdo não encontrado' });

  const coordinatorId = Number(req.body.coordinator_id);
  if (!coordinatorId) return res.status(400).json({ error: 'Selecione o coordenador' });

  const coord = db.prepare(
    'SELECT id FROM coordinators WHERE id = ? AND campaign_id = ?'
  ).get(coordinatorId, campaign.id);
  if (!coord) return res.status(400).json({ error: 'Coordenador inválido' });

  const result = db.prepare(`
    INSERT INTO content_assignments (
      content_post_id, coordinator_id, municipality_id,
      target_views, actual_views, target_comments, actual_comments, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    post.id,
    coordinatorId,
    req.body.municipality_id ? Number(req.body.municipality_id) : null,
    Math.max(0, Number(req.body.target_views) || 0),
    Math.max(0, Number(req.body.actual_views) || 0),
    Math.max(0, Number(req.body.target_comments) || 0),
    Math.max(0, Number(req.body.actual_comments) || 0),
    req.body.status || 'pendente',
    req.body.notes || null,
  );

  const row = db.prepare('SELECT * FROM content_assignments WHERE id = ?').get(result.lastInsertRowid);
  const detail = buildContentDetail(db, db.prepare('SELECT * FROM content_posts WHERE id = ?').get(post.id));
  res.status(201).json({
    assignment: detail.assignments.find((a) => a.id === row.id),
    post: detail,
  });
});

app.patch('/api/campaigns/:slug/content/:id/assignments/:assignmentId', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const post = db.prepare(
    'SELECT * FROM content_posts WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!post) return res.status(404).json({ error: 'Conteúdo não encontrado' });

  const assignment = db.prepare(`
    SELECT * FROM content_assignments
    WHERE id = ? AND content_post_id = ?
  `).get(req.params.assignmentId, post.id);
  if (!assignment) return res.status(404).json({ error: 'Atribuição não encontrada' });

  db.prepare(`
    UPDATE content_assignments SET
      target_views = ?,
      actual_views = ?,
      target_comments = ?,
      actual_comments = ?,
      status = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.target_views !== undefined ? Math.max(0, Number(req.body.target_views) || 0) : assignment.target_views,
    req.body.actual_views !== undefined ? Math.max(0, Number(req.body.actual_views) || 0) : assignment.actual_views,
    req.body.target_comments !== undefined ? Math.max(0, Number(req.body.target_comments) || 0) : assignment.target_comments,
    req.body.actual_comments !== undefined ? Math.max(0, Number(req.body.actual_comments) || 0) : assignment.actual_comments,
    req.body.status || assignment.status,
    req.body.notes !== undefined ? req.body.notes : assignment.notes,
    assignment.id,
  );

  const updated = db.prepare('SELECT * FROM content_assignments WHERE id = ?').get(assignment.id);
  if (updated.coordinator_id && updated.municipality_id && req.body.actual_views !== undefined) {
    db.prepare(`
      UPDATE coordinator_municipalities SET
        content_views_actual = CASE
          WHEN ? > content_views_actual THEN ? ELSE content_views_actual END
      WHERE coordinator_id = ? AND municipality_id = ?
    `).run(updated.actual_views, updated.actual_views, updated.coordinator_id, updated.municipality_id);
  }

  res.json(buildContentDetail(db, post));
});

app.delete('/api/campaigns/:slug/content/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const post = db.prepare(
    'SELECT * FROM content_posts WHERE id = ? AND campaign_id = ?'
  ).get(req.params.id, campaign.id);
  if (!post) return res.status(404).json({ error: 'Conteúdo não encontrado' });
  db.prepare('DELETE FROM content_posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

/* ---------- Conteúdos mobilizados (Bitly + grupos/canais) ---------- */
function getMobilizedOwned(slug, id) {
  const campaign = getCampaignBySlug(slug);
  if (!campaign) return { error: { status: 404, message: 'Campanha não encontrada' } };
  const row = db.prepare(
    'SELECT * FROM mobilized_contents WHERE id = ? AND campaign_id = ?'
  ).get(id, campaign.id);
  if (!row) return { error: { status: 404, message: 'Conteúdo mobilizado não encontrado' } };
  return { campaign, row };
}

app.get('/api/campaigns/:slug/mobilized', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const list = listMobilizedContents(db, campaign.id, {
      coordinatorId: req.query.coordinator_id,
      municipalityId: req.query.municipality_id,
    });
    const bitly = bitlyConfigured() ? await probeBitlyToken() : bitlyStatus();
    res.json({ ...list, bitly });
  } catch (err) {
    console.error('GET mobilized:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar conteúdos mobilizados' });
  }
});

app.post('/api/campaigns/:slug/mobilized', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const title = String(req.body.title || '').trim();
    let bitlyUrl = String(req.body.bitly_url || '').trim();
    let destinationUrl = req.body.destination_url ? String(req.body.destination_url).trim() : null;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const coordinatorId = req.body.coordinator_id ? Number(req.body.coordinator_id) : null;
    const municipalityId = req.body.municipality_id ? Number(req.body.municipality_id) : null;
    const contentPostId = req.body.content_post_id ? Number(req.body.content_post_id) : null;

    if (!bitlyUrl && destinationUrl && bitlyConfigured()) {
      const tags = [];
      if (coordinatorId) {
        const cName = db.prepare('SELECT name FROM coordinators WHERE id = ?').get(coordinatorId)?.name;
        if (cName) tags.push(String(cName).slice(0, 40));
      }
      if (municipalityId) {
        const mName = db.prepare('SELECT name FROM municipalities WHERE id = ?').get(municipalityId)?.name;
        if (mName) tags.push(String(mName).slice(0, 40));
      }
      const createdBit = await createBitlink(destinationUrl, {
        title,
        tags,
        custom_bitlink: req.body.custom_bitlink || undefined,
      });
      bitlyUrl = createdBit.bitly_url;
      destinationUrl = createdBit.destination_url || destinationUrl;
    }
    if (!bitlyUrl) {
      return res.status(400).json({
        error: bitlyConfigured()
          ? 'Informe o link Bitly ou a URL de destino para encurtar'
          : 'Link Bitly é obrigatório (ou configure BITLY_ACCESS_TOKEN para criar automaticamente)',
      });
    }

    const result = db.prepare(`
      INSERT INTO mobilized_contents (
        campaign_id, title, bitly_url, destination_url, clicks, views, notes, status,
        coordinator_id, municipality_id, content_post_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?, ?)
    `).run(
      campaign.id,
      title,
      bitlyUrl,
      destinationUrl,
      Math.max(0, Number(req.body.clicks) || 0),
      Math.max(0, Number(req.body.views) || 0),
      req.body.notes ? String(req.body.notes).trim() : null,
      coordinatorId,
      municipalityId,
      contentPostId,
    );

    let row = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(result.lastInsertRowid);

    const channels = Array.isArray(req.body.channels) ? req.body.channels : [];
    const insertCh = db.prepare(`
      INSERT INTO mobilized_content_channels (
        mobilized_content_id, channel_type, channel_name, members_count, sent_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const ch of channels) {
      const name = String(ch.channel_name || ch.name || '').trim();
      if (!name) continue;
      insertCh.run(
        row.id,
        ch.channel_type === 'canal' ? 'canal' : 'grupo',
        name,
        Math.max(0, Number(ch.members_count) || 0),
        ch.sent_at || new Date().toISOString().slice(0, 10),
        ch.notes || null,
      );
    }

    if (bitlyConfigured()) {
      try {
        const synced = await syncMobilizedFromBitly(db, row);
        row = synced.row;
      } catch (_) { /* ok */ }
    }

    res.status(201).json(enrichMobilizedContent(db, row));
  } catch (err) {
    console.error('POST mobilized:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro ao criar conteúdo' });
  }
});

/** Cria vários bitlinks a partir de URLs longas (Bitly pago / create). */
app.post('/api/campaigns/:slug/mobilized/bulk', async (req, res) => {
  try {
    const campaign = getCampaignBySlug(req.params.slug);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (!bitlyConfigured()) {
      return res.status(503).json({
        error: 'Configure BITLY_ACCESS_TOKEN no Render para criar links em massa',
        bitly: bitlyStatus(),
      });
    }

    const lines = Array.isArray(req.body.items)
      ? req.body.items
      : String(req.body.urls || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [url, ...rest] = line.split('|').map((s) => s.trim());
          return { destination_url: url, title: rest.join(' | ') || null };
        });

    if (!lines.length) {
      return res.status(400).json({ error: 'Cole pelo menos uma URL (uma por linha)' });
    }
    if (lines.length > 40) {
      return res.status(400).json({ error: 'Máximo de 40 links por vez' });
    }

    const created = [];
    const errors = [];
    const titlePrefix = req.body.title_prefix ? String(req.body.title_prefix).trim() : '';

    for (let i = 0; i < lines.length; i += 1) {
      const item = lines[i] || {};
      const longUrl = String(item.destination_url || item.url || '').trim();
      const title = String(item.title || '').trim()
        || (titlePrefix ? `${titlePrefix} ${i + 1}` : `Conteúdo ${i + 1}`);
      try {
        if (i > 0) await bitlySleep(220);
        const tags = [];
        const coordinatorId = req.body.coordinator_id
          ? Number(req.body.coordinator_id)
          : (item.coordinator_id ? Number(item.coordinator_id) : null);
        const municipalityId = req.body.municipality_id
          ? Number(req.body.municipality_id)
          : (item.municipality_id ? Number(item.municipality_id) : null);
        if (coordinatorId) {
          const cName = db.prepare('SELECT name FROM coordinators WHERE id = ?').get(coordinatorId)?.name;
          if (cName) tags.push(String(cName).slice(0, 40));
        }
        if (municipalityId) {
          const mName = db.prepare('SELECT name FROM municipalities WHERE id = ?').get(municipalityId)?.name;
          if (mName) tags.push(String(mName).slice(0, 40));
        }
        const bit = await createBitlink(longUrl, { title, tags });
        const result = db.prepare(`
          INSERT INTO mobilized_contents (
            campaign_id, title, bitly_url, destination_url, clicks, views, notes, status,
            coordinator_id, municipality_id
          ) VALUES (?, ?, ?, ?, 0, 0, ?, 'ativo', ?, ?)
        `).run(
          campaign.id,
          title,
          bit.bitly_url,
          bit.destination_url,
          item.notes ? String(item.notes).trim() : null,
          coordinatorId,
          municipalityId,
        );
        const row = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(result.lastInsertRowid);
        let enriched = enrichMobilizedContent(db, row);
        try {
          const synced = await syncMobilizedFromBitly(db, row);
          enriched = enrichMobilizedContent(db, synced.row);
        } catch {
          /* ok sem sync imediato */
        }
        created.push(enriched);
      } catch (err) {
        errors.push({
          line: i + 1,
          url: longUrl,
          error: err.message || 'Falha ao criar bitlink',
        });
      }
    }

    res.status(201).json({
      ok: true,
      created_count: created.length,
      error_count: errors.length,
      items: created,
      errors,
      bitly: bitlyStatus(),
      summary: listMobilizedContents(db, campaign.id).summary,
    });
  } catch (err) {
    console.error('POST mobilized bulk:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro na criação em massa' });
  }
});

app.patch('/api/campaigns/:slug/mobilized/:id', (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });
  const { row } = owned;

  const title = req.body.title != null ? String(req.body.title).trim() : row.title;
  const bitlyUrl = req.body.bitly_url != null ? String(req.body.bitly_url).trim() : row.bitly_url;
  if (!title) return res.status(400).json({ error: 'Título inválido' });
  if (!bitlyUrl) return res.status(400).json({ error: 'Link Bitly inválido' });

  const coordinatorId = req.body.coordinator_id !== undefined
    ? (req.body.coordinator_id ? Number(req.body.coordinator_id) : null)
    : row.coordinator_id;
  const municipalityId = req.body.municipality_id !== undefined
    ? (req.body.municipality_id ? Number(req.body.municipality_id) : null)
    : row.municipality_id;

  db.prepare(`
    UPDATE mobilized_contents SET
      title = ?, bitly_url = ?, destination_url = ?,
      clicks = ?, views = ?, notes = ?, status = ?,
      coordinator_id = ?, municipality_id = ?
    WHERE id = ?
  `).run(
    title,
    bitlyUrl,
    req.body.destination_url !== undefined
      ? (req.body.destination_url ? String(req.body.destination_url).trim() : null)
      : row.destination_url,
    req.body.clicks !== undefined ? Math.max(0, Number(req.body.clicks) || 0) : row.clicks,
    req.body.views !== undefined ? Math.max(0, Number(req.body.views) || 0) : row.views,
    req.body.notes !== undefined ? req.body.notes : row.notes,
    req.body.status || row.status,
    coordinatorId,
    municipalityId,
    row.id,
  );

  const updated = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(row.id);
  res.json(enrichMobilizedContent(db, updated));
});

app.delete('/api/campaigns/:slug/mobilized/:id', (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });
  db.prepare('DELETE FROM mobilized_contents WHERE id = ?').run(owned.row.id);
  res.json({ ok: true });
});

app.post('/api/campaigns/:slug/mobilized/:id/channels', (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });

  const name = String(req.body.channel_name || req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome do grupo/canal é obrigatório' });

  const result = db.prepare(`
    INSERT INTO mobilized_content_channels (
      mobilized_content_id, channel_type, channel_name, members_count, sent_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    owned.row.id,
    req.body.channel_type === 'canal' ? 'canal' : 'grupo',
    name,
    Math.max(0, Number(req.body.members_count) || 0),
    req.body.sent_at || new Date().toISOString().slice(0, 10),
    req.body.notes || null,
  );

  const channel = db.prepare('SELECT * FROM mobilized_content_channels WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({
    channel,
    content: enrichMobilizedContent(db, owned.row),
  });
});

app.patch('/api/campaigns/:slug/mobilized/:id/channels/:channelId', (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });

  const channel = db.prepare(`
    SELECT * FROM mobilized_content_channels
    WHERE id = ? AND mobilized_content_id = ?
  `).get(req.params.channelId, owned.row.id);
  if (!channel) return res.status(404).json({ error: 'Grupo/canal não encontrado' });

  const name = req.body.channel_name != null
    ? String(req.body.channel_name).trim()
    : channel.channel_name;
  if (!name) return res.status(400).json({ error: 'Nome inválido' });

  db.prepare(`
    UPDATE mobilized_content_channels SET
      channel_type = ?, channel_name = ?, members_count = ?, sent_at = ?, notes = ?
    WHERE id = ?
  `).run(
    req.body.channel_type === 'canal' || req.body.channel_type === 'grupo'
      ? req.body.channel_type
      : channel.channel_type,
    name,
    req.body.members_count !== undefined
      ? Math.max(0, Number(req.body.members_count) || 0)
      : channel.members_count,
    req.body.sent_at !== undefined ? req.body.sent_at : channel.sent_at,
    req.body.notes !== undefined ? req.body.notes : channel.notes,
    channel.id,
  );

  const updated = db.prepare('SELECT * FROM mobilized_content_channels WHERE id = ?').get(channel.id);
  const content = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(owned.row.id);
  res.json({
    channel: updated,
    content: enrichMobilizedContent(db, content),
  });
});

app.delete('/api/campaigns/:slug/mobilized/:id/channels/:channelId', (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });

  const channel = db.prepare(`
    SELECT * FROM mobilized_content_channels
    WHERE id = ? AND mobilized_content_id = ?
  `).get(req.params.channelId, owned.row.id);
  if (!channel) return res.status(404).json({ error: 'Grupo/canal não encontrado' });

  db.prepare('DELETE FROM mobilized_content_channels WHERE id = ?').run(channel.id);
  const content = db.prepare('SELECT * FROM mobilized_contents WHERE id = ?').get(owned.row.id);
  res.json({ ok: true, content: enrichMobilizedContent(db, content) });
});

app.post('/api/campaigns/:slug/mobilized/:id/sync', async (req, res) => {
  const owned = getMobilizedOwned(req.params.slug, req.params.id);
  if (owned.error) return res.status(owned.error.status).json({ error: owned.error.message });

  try {
    const { row, analytics } = await syncMobilizedFromBitly(db, owned.row);
    if (!analytics.ok) {
      return res.status(analytics.mode === 'manual' ? 400 : 502).json({
        error: analytics.error || 'Falha ao sincronizar Bitly',
        bitly: bitlyStatus(),
      });
    }
    res.json({
      content: enrichMobilizedContent(db, row),
      analytics,
      bitly: bitlyStatus(),
    });
  } catch (err) {
    console.error('POST mobilized sync:', err);
    res.status(502).json({ error: err.message || 'Erro na API Bitly', bitly: bitlyStatus() });
  }
});

app.post('/api/campaigns/:slug/mobilized/sync', async (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const status = bitlyStatus();
  if (!status.configured) {
    return res.status(400).json({ error: status.hint, bitly: status });
  }

  const rows = db.prepare(`
    SELECT * FROM mobilized_contents
    WHERE campaign_id = ? AND status != 'arquivado'
    ORDER BY id DESC
  `).all(campaign.id);

  const results = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      if (i > 0) await bitlySleep(180);
      const { row: updated, analytics } = await syncMobilizedFromBitly(db, row);
      results.push({
        id: row.id,
        ok: analytics.ok,
        clicks: updated?.clicks ?? row.clicks,
        error: analytics.ok ? null : analytics.error,
      });
    } catch (err) {
      results.push({ id: row.id, ok: false, error: err.message });
    }
  }

  res.json({
    ...listMobilizedContents(db, campaign.id),
    sync: results,
    bitly: bitlyStatus(),
  });
});

app.post('/api/campaigns/:slug/meta/sync', async (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  try {
    const snapshot = await fetchInstagramSnapshot();
    if (!snapshot.ok) {
      return res.status(400).json({
        error: snapshot.error || 'Não foi possível sincronizar Instagram',
        meta: metaStatus(),
      });
    }

    const links = db.prepare(`
      SELECT cm.* FROM coordinator_municipalities cm
      JOIN coordinators c ON c.id = cm.coordinator_id
      WHERE c.campaign_id = ?
    `).all(campaign.id);

    const distributed = distributeIgTotals(links, snapshot.totals);
    const now = new Date().toISOString();
    saveIgAccountSnapshot(db, campaign.id, snapshot.totals, now, snapshot.profile);
    const update = db.prepare(`
      UPDATE coordinator_municipalities SET
        ig_comments = ?,
        ig_reach = ?,
        content_views_actual = CASE
          WHEN ? > content_views_actual THEN ?
          ELSE content_views_actual
        END,
        last_meta_sync = ?
      WHERE coordinator_id = ? AND municipality_id = ?
    `);

    db.transaction(() => {
      for (const d of distributed) {
        update.run(
          d.ig_comments,
          d.ig_reach,
          d.content_views_actual,
          d.content_views_actual,
          now,
          d.coordinator_id,
          d.municipality_id,
        );
      }

      // Importa/atualiza posts do IG na aba Conteúdo
      for (const m of snapshot.media || []) {
        const title = ((m.caption || 'Post Instagram').trim().split('\n')[0] || 'Post Instagram').slice(0, 80);
        const existing = db.prepare(`
          SELECT id FROM content_posts WHERE campaign_id = ? AND meta_media_id = ?
        `).get(campaign.id, String(m.id));
        if (existing) {
          db.prepare(`
            UPDATE content_posts SET
              likes = ?, comments = ?, reach = ?, permalink = ?, caption = ?
            WHERE id = ?
          `).run(
            Number(m.like_count || 0),
            Number(m.comments_count || 0),
            Number(m.reach || m.impressions || 0),
            m.permalink || null,
            m.caption || '',
            existing.id,
          );
        } else {
          db.prepare(`
            INSERT INTO content_posts (
              campaign_id, title, caption, permalink, posted_at, source,
              meta_media_id, likes, comments, reach, status
            ) VALUES (?, ?, ?, ?, ?, 'meta', ?, ?, ?, ?, 'ativa')
          `).run(
            campaign.id,
            title,
            m.caption || '',
            m.permalink || null,
            (m.timestamp || '').slice(0, 10) || now.slice(0, 10),
            String(m.id),
            Number(m.like_count || 0),
            Number(m.comments_count || 0),
            Number(m.reach || m.impressions || 0),
          );
        }
      }
    })();

    const week = listContentWeek(db, campaign.id);

    res.json({
      ok: true,
      synced_at: now,
      totals: snapshot.totals,
      ig_account: readIgAccountSnapshot(db, campaign.id),
      municipalities_updated: distributed.length,
      content_posts: week.posts.length,
      media_sample: (snapshot.media || []).slice(0, 8).map((m) => ({
        id: m.id,
        caption: (m.caption || '').slice(0, 120),
        comments_count: m.comments_count,
        like_count: m.like_count,
        reach: m.reach || m.impressions || 0,
        permalink: m.permalink,
      })),
      note: 'Totais da conta são reais. Números por município são estimativa (o Instagram não informa a cidade do comentário).',
      meta: metaStatus(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao sincronizar Meta' });
  }
});

app.put('/api/campaigns/:slug/meta/config', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const ig_username = req.body.ig_username || null;
  const ig_user_id = req.body.ig_user_id || null;
  const content_views_threshold = req.body.content_views_threshold != null
    ? Number(req.body.content_views_threshold)
    : 0.5;
  const vote_progress_threshold = req.body.vote_progress_threshold != null
    ? Number(req.body.vote_progress_threshold)
    : 0.15;
  const notes = req.body.notes || null;

  db.prepare(`
    INSERT INTO campaign_meta_config (
      campaign_id, ig_user_id, ig_username, content_views_threshold, vote_progress_threshold, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(campaign_id) DO UPDATE SET
      ig_user_id = excluded.ig_user_id,
      ig_username = excluded.ig_username,
      content_views_threshold = excluded.content_views_threshold,
      vote_progress_threshold = excluded.vote_progress_threshold,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    campaign.id,
    ig_user_id,
    ig_username,
    content_views_threshold,
    vote_progress_threshold,
    notes,
  );

  res.json(db.prepare('SELECT * FROM campaign_meta_config WHERE campaign_id = ?').get(campaign.id));
});

/* ---------- Municipalities list ---------- */
app.get('/api/municipalities', (_req, res) => {
  res.json(db.prepare('SELECT * FROM municipalities ORDER BY name').all());
});

app.post('/api/municipalities/sync', (_req, res) => {
  const { seedMunicipalities } = require('./seed');
  const total = seedMunicipalities(db);
  res.json({ ok: true, total });
});

app.patch('/api/municipalities/:id', (req, res) => {
  const municipality = db.prepare('SELECT * FROM municipalities WHERE id = ?').get(req.params.id);
  if (!municipality) return res.status(404).json({ error: 'Município não encontrado' });

  const coordinator_name = req.body.coordinator_name ?? municipality.coordinator_name;
  db.prepare('UPDATE municipalities SET coordinator_name = ? WHERE id = ?')
    .run(coordinator_name || null, municipality.id);

  // Keep coordinators table in sync when editing via legacy admin field
  if (coordinator_name && String(coordinator_name).trim()) {
    const campaign = db.prepare("SELECT * FROM campaigns WHERE slug = 'fabio-garcia'").get()
      || db.prepare('SELECT * FROM campaigns ORDER BY id LIMIT 1').get();
    if (campaign) {
      const name = String(coordinator_name).trim();
      let coord = db.prepare('SELECT * FROM coordinators WHERE campaign_id = ? AND name = ?')
        .get(campaign.id, name);
      if (!coord) {
        const r = db.prepare(`
          INSERT INTO coordinators (campaign_id, name) VALUES (?, ?)
        `).run(campaign.id, name);
        coord = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(r.lastInsertRowid);
      }
      setCoordinatorMunicipalities(
        campaign.id,
        coord.id,
        [
          ...db.prepare('SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?')
            .all(coord.id)
            .map((r) => r.municipality_id),
          municipality.id,
        ],
      );
    }
  }

  res.json(db.prepare('SELECT * FROM municipalities WHERE id = ?').get(municipality.id));
});

/* ---------- Production static ---------- */
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(clientDist, 'index.html');
  res.sendFile(index, (err) => {
    if (err) next();
  });
});

async function start() {
  db = await getDb();
  setAuthDb(db);
  seedProduction(db);
  if (process.env.SEED_DEMO === 'true') {
    seedDemo(db);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atlas Agency API em http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
