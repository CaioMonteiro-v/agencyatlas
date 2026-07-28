const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');
const { getDb } = require('./db');
const { seedProduction, seedDemo } = require('./seed');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/logos', express.static(path.join(__dirname, '../public/logos')));

let db;

function getCampaignBySlug(slug) {
  return db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(slug);
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
  res.json({ ok: true, service: 'atlas-agency' });
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

  const points = db.prepare(`
    SELECT lat, lng FROM registrations
    WHERE campaign_id = ? AND lat IS NOT NULL AND lng IS NOT NULL
  `).all(campaign.id);

  const municipalities = db.prepare(`
    SELECT
      m.*,
      COALESCE(COUNT(r.id), 0) AS registrations_count
    FROM municipalities m
    LEFT JOIN registrations r ON r.municipality_id = m.id AND r.campaign_id = ?
    GROUP BY m.id
    ORDER BY registrations_count DESC, m.name ASC
  `).all(campaign.id);

  res.json({ points, municipalities });
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
    where += ' AND (r.full_name LIKE ? OR r.phone LIKE ? OR r.referral_code LIKE ? OR l.name LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
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
      (SELECT COUNT(*) FROM registrations r2 WHERE r2.leader_id = r.leader_id) AS mobilizer_total
    FROM registrations r
    LEFT JOIN leaders l ON l.id = r.leader_id
    LEFT JOIN municipalities m ON m.id = r.municipality_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ total, page, limit, items: rows });
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
    INSERT INTO registrations (campaign_id, leader_id, municipality_id, full_name, phone, email, source, referral_code, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    muni ? muni.lng + (Math.random() - 0.5) * 0.06 : null
  );

  res.status(201).json(db.prepare('SELECT * FROM registrations WHERE id = ?').get(result.lastInsertRowid));
});

/* ---------- Events + QR ---------- */
app.get('/api/campaigns/:slug/events', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS attendees
    FROM events e
    WHERE e.campaign_id = ?
    ORDER BY e.event_date ASC
  `).all(campaign.id);

  res.json(events);
});

app.post('/api/campaigns/:slug/events', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const { name, description, location, event_date, event_time } = req.body;
  if (!name || !event_date) return res.status(400).json({ error: 'Nome e data são obrigatórios' });

  const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nano().slice(0, 4)}`;

  const result = db.prepare(`
    INSERT INTO events (campaign_id, name, description, location, event_date, event_time, slug)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(campaign.id, name, description || '', location || '', event_date, event_time || '', slug);

  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid));
});

app.get('/api/events/:slug', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, c.name AS campaign_name, c.slug AS campaign_slug, c.whatsapp_url, c.accent_color
    FROM events e
    JOIN campaigns c ON c.id = e.campaign_id
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
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
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

  const { full_name, email, phone, connect_whatsapp } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Nome completo é obrigatório' });
  if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório' });

  const result = db.prepare(`
    INSERT INTO event_registrations (event_id, full_name, email, phone, connect_whatsapp)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, full_name, email || null, phone || null, connect_whatsapp ? 1 : 0);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(event.campaign_id);

  // Também entra no Registro de Cadastros da campanha (origem = evento)
  const reg = db.prepare(`
    INSERT INTO registrations (campaign_id, leader_id, municipality_id, full_name, phone, email, source, referral_code, lat, lng)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)
  `).run(
    event.campaign_id,
    full_name,
    phone,
    email || null,
    `evento/${event.slug}`
  );

  res.status(201).json({
    registration: db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(result.lastInsertRowid),
    campaign_registration_id: reg.lastInsertRowid,
    whatsapp_url: campaign?.whatsapp_url || 'https://bit.ly/FalaFabio',
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
function assessMunicipalityHealth(regs, leadersCount, avgRegs) {
  if (regs === 0 && leadersCount === 0) {
    return {
      status: 'critical',
      label: 'Sem movimento',
      detail: 'Sem cadastros e sem lideranças neste município',
    };
  }
  if (regs === 0) {
    return {
      status: 'critical',
      label: 'Falha',
      detail: 'Há liderança, mas nenhum cadastro recebido',
    };
  }
  if (avgRegs > 0 && regs < avgRegs * 0.4) {
    return {
      status: 'attention',
      label: 'Atenção',
      detail: 'Recebendo abaixo da média da coordenação',
    };
  }
  if (avgRegs > 0 && regs >= avgRegs * 1.2) {
    return {
      status: 'good',
      label: 'Forte',
      detail: 'Acima da média da coordenação',
    };
  }
  return {
    status: 'ok',
    label: 'Tranquilo',
    detail: 'Recebendo cadastros normalmente',
  };
}

function buildCoordinatorDetail(campaign, coordinator) {
  const munis = db.prepare(`
    SELECT
      m.*,
      COALESCE((
        SELECT COUNT(*) FROM registrations r
        WHERE r.municipality_id = m.id AND r.campaign_id = ?
      ), 0) AS registrations_count,
      COALESCE((
        SELECT COUNT(*) FROM leaders l
        WHERE l.municipality_id = m.id AND l.campaign_id = ?
      ), 0) AS leaders_count
    FROM coordinator_municipalities cm
    JOIN municipalities m ON m.id = cm.municipality_id
    WHERE cm.coordinator_id = ?
    ORDER BY registrations_count DESC, m.name ASC
  `).all(campaign.id, campaign.id, coordinator.id);

  const totalRegs = munis.reduce((s, m) => s + Number(m.registrations_count || 0), 0);
  const avg = munis.length ? totalRegs / munis.length : 0;

  const municipalities = munis.map((m) => {
    const regs = Number(m.registrations_count || 0);
    const leadersCount = Number(m.leaders_count || 0);
    const health = assessMunicipalityHealth(regs, leadersCount, avg);
    const share_pct = totalRegs > 0 ? Math.round((regs / totalRegs) * 1000) / 10 : 0;
    return { ...m, registrations_count: regs, leaders_count: leadersCount, health, share_pct };
  });

  const critical = municipalities.filter((m) => m.health.status === 'critical').length;
  const attention = municipalities.filter((m) => m.health.status === 'attention').length;
  const ok = municipalities.filter((m) => m.health.status === 'ok' || m.health.status === 'good').length;

  let health;
  if (municipalities.length === 0) {
    health = { status: 'empty', label: 'Sem municípios', detail: 'Vincule municípios a este coordenador' };
  } else if (critical > 0) {
    health = { status: 'critical', label: 'Com falhas', detail: `${critical} município(s) em falha` };
  } else if (attention > 0) {
    health = { status: 'attention', label: 'Atenção', detail: `${attention} município(s) abaixo da média` };
  } else {
    health = { status: 'good', label: 'Tranquilo', detail: 'Municípios recebendo normalmente' };
  }

  return {
    ...coordinator,
    municipalities,
    totals: {
      municipalities: municipalities.length,
      registrations: totalRegs,
      leaders: municipalities.reduce((s, m) => s + m.leaders_count, 0),
      critical,
      attention,
      ok,
    },
    health,
  };
}

function setCoordinatorMunicipalities(campaignId, coordinatorId, municipalityIds) {
  const coord = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(coordinatorId, campaignId);
  if (!coord) return null;

  const ids = [...new Set((municipalityIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const prev = db.prepare('SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?')
    .all(coordinatorId);

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

      db.prepare('INSERT INTO coordinator_municipalities (coordinator_id, municipality_id) VALUES (?, ?)')
        .run(coordinatorId, mid);
      db.prepare('UPDATE municipalities SET coordinator_name = ? WHERE id = ?').run(coord.name, mid);
    }
  })();

  return coord;
}

app.get('/api/campaigns/:slug/coordinators', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const rows = db.prepare(`
    SELECT * FROM coordinators WHERE campaign_id = ? ORDER BY name ASC
  `).all(campaign.id);

  const coordinators = rows.map((c) => buildCoordinatorDetail(campaign, c));
  const summary = {
    total: coordinators.length,
    municipalities_assigned: coordinators.reduce((s, c) => s + c.totals.municipalities, 0),
    registrations: coordinators.reduce((s, c) => s + c.totals.registrations, 0),
    with_failures: coordinators.filter((c) => c.health.status === 'critical').length,
  };

  res.json({ coordinators, summary });
});

app.get('/api/campaigns/:slug/coordinators/:id', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(req.params.id, campaign.id);
  if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

  res.json(buildCoordinatorDetail(campaign, coordinator));
});

app.post('/api/campaigns/:slug/coordinators', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const { name, phone, photo_url, notes, municipality_ids } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Nome do coordenador é obrigatório' });
  }

  const result = db.prepare(`
    INSERT INTO coordinators (campaign_id, name, phone, photo_url, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    campaign.id,
    String(name).trim(),
    phone || null,
    photo_url || null,
    notes || null,
  );

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(result.lastInsertRowid);
  if (Array.isArray(municipality_ids) && municipality_ids.length) {
    setCoordinatorMunicipalities(campaign.id, coordinator.id, municipality_ids);
  }

  res.status(201).json(buildCoordinatorDetail(campaign, coordinator));
});

app.patch('/api/campaigns/:slug/coordinators/:id', (req, res) => {
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

  db.prepare(`
    UPDATE coordinators SET name = ?, phone = ?, photo_url = ?, notes = ? WHERE id = ?
  `).run(name, phone, photo_url, notes, coordinator.id);

  if (name !== coordinator.name) {
    db.prepare(`
      UPDATE municipalities SET coordinator_name = ?
      WHERE id IN (
        SELECT municipality_id FROM coordinator_municipalities WHERE coordinator_id = ?
      )
    `).run(name, coordinator.id);
  }

  if (Array.isArray(req.body.municipality_ids)) {
    setCoordinatorMunicipalities(campaign.id, coordinator.id, req.body.municipality_ids);
  }

  const updated = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(coordinator.id);
  res.json(buildCoordinatorDetail(campaign, updated));
});

app.put('/api/campaigns/:slug/coordinators/:id/municipalities', (req, res) => {
  const campaign = getCampaignBySlug(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const coordinator = db.prepare('SELECT * FROM coordinators WHERE id = ? AND campaign_id = ?')
    .get(req.params.id, campaign.id);
  if (!coordinator) return res.status(404).json({ error: 'Coordenador não encontrado' });

  const ok = setCoordinatorMunicipalities(campaign.id, coordinator.id, req.body.municipality_ids || []);
  if (!ok) return res.status(404).json({ error: 'Coordenador não encontrado' });

  const updated = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(coordinator.id);
  res.json(buildCoordinatorDetail(campaign, updated));
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
