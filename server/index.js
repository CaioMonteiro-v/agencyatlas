const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');
const db = require('./db');

require('./seed');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/logos', express.static(path.join(__dirname, '../public/logos')));

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
    HAVING registrations_count > 0 OR m.coordinator_name IS NOT NULL
    ORDER BY registrations_count DESC
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

  const origin = req.query.origin || `${req.protocol}://${req.get('host')}`.replace(':3001', ':5173');
  const url = `${origin}/evento/${event.slug}`;

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: '#2C3E3A', light: '#FFFFFF' },
    });
    res.json({ url, qrcode: dataUrl, event });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar QR Code', detail: err.message });
  }
});

app.post('/api/events/:slug/registrations', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

  const { full_name, email, phone, connect_whatsapp } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Nome completo é obrigatório' });

  const result = db.prepare(`
    INSERT INTO event_registrations (event_id, full_name, email, phone, connect_whatsapp)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, full_name, email || null, phone || null, connect_whatsapp ? 1 : 0);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(event.campaign_id);
  res.status(201).json({
    registration: db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(result.lastInsertRowid),
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

/* ---------- Municipalities list ---------- */
app.get('/api/municipalities', (_req, res) => {
  res.json(db.prepare('SELECT * FROM municipalities ORDER BY name').all());
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

app.listen(PORT, () => {
  console.log(`Atlas Agency API em http://localhost:${PORT}`);
});
