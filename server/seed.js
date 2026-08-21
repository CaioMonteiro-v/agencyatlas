const path = require('path');
const fs = require('fs');
const { customAlphabet } = require('nanoid');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

function loadMunicipalities() {
  const file = path.join(__dirname, 'data', 'mt-municipalities.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

const leaderDefs = [
  { name: 'Mariana Lopes', type: 'politica', muni: 'Cuiabá', status: 'ativo' },
  { name: 'Pedro Henrique Santos', type: 'politica', muni: 'Cuiabá', status: 'ativo' },
  { name: 'Juliana Freitas', type: 'multiplicador', muni: 'Cuiabá', status: 'ativo' },
  { name: 'Rafael Moura', type: 'multiplicador', muni: 'Várzea Grande', status: 'ativo' },
  { name: 'Amanda Vieira', type: 'politica', muni: 'Rondonópolis', status: 'ativo' },
  { name: 'Thiago Barbosa', type: 'multiplicador', muni: 'Rondonópolis', status: 'ativo' },
  { name: 'Cristina Almeida', type: 'politica', muni: 'Sinop', status: 'ativo' },
  { name: 'Bruno Carvalho', type: 'multiplicador', muni: 'Sinop', status: 'inativo' },
  { name: 'Larissa Pires', type: 'politica', muni: 'Tangará da Serra', status: 'ativo' },
  { name: 'Felipe Gomes', type: 'multiplicador', muni: 'Barra do Garças', status: 'ativo' },
  { name: 'Natália Souza', type: 'politica', muni: 'Colíder', status: 'ativo' },
  { name: 'Eduardo Ramos', type: 'multiplicador', muni: 'Colíder', status: 'ativo' },
  { name: 'Vanessa Torres', type: 'multiplicador', muni: 'Sorriso', status: 'ativo' },
  { name: 'Igor Teixeira', type: 'politica', muni: 'Lucas do Rio Verde', status: 'ativo' },
  { name: 'Priscila Duarte', type: 'multiplicador', muni: 'Primavera do Leste', status: 'ativo' },
  { name: 'Henrique Castro', type: 'multiplicador', muni: 'Alta Floresta', status: 'ativo' },
  { name: 'Sabrina Melo', type: 'politica', muni: 'Cáceres', status: 'ativo' },
  { name: 'Leonardo Azevedo', type: 'multiplicador', muni: 'Nova Mutum', status: 'inativo' },
  { name: 'Gabriela Nascimento', type: 'multiplicador', muni: 'Campo Verde', status: 'ativo' },
  { name: 'Rodrigo Farias', type: 'politica', muni: 'Água Boa', status: 'ativo' },
];

const firstNames = ['Maria', 'José', 'Ana', 'João', 'Francisca', 'Antonio', 'Antonia', 'Carlos', 'Adriana', 'Paulo', 'Juliana', 'Pedro', 'Márcia', 'Lucas', 'Fernanda', 'Marcos', 'Patricia', 'Rafael', 'Aline', 'Bruno'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Rocha', 'Almeida', 'Nunes', 'Moreira', 'Barbosa', 'Araújo'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const ddd = ['65', '66'][Math.floor(Math.random() * 2)];
  const n = String(Math.floor(900000000 + Math.random() * 99999999)).slice(0, 9);
  return `(${ddd}) 9${n.slice(0, 4)}-${n.slice(4)}`;
}

function jitter(base, amount = 0.08) {
  return base + (Math.random() - 0.5) * amount;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 14) + 7, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function ensureBaseCampaign(db) {
  let campaign = db.prepare("SELECT * FROM campaigns WHERE slug = 'fabio-garcia'").get();
  if (campaign) {
    // Federal 2026 — atualiza identidade sem quebrar slug/URLs
    db.prepare(`
      UPDATE campaigns SET
        name = ?,
        candidate = ?,
        description = ?,
        mission = ?
      WHERE slug = 'fabio-garcia'
    `).run(
      'Campanha Fábio Garcia — Deputado Federal',
      'Fábio Garcia · Deputado Federal por Mato Grosso',
      'Mobilização federal em todo o Mato Grosso: território, lideranças e conversão digital.',
      'Articular os 142 municípios, conectar coordenadores e transformar presença em voto federal.',
    );
    return db.prepare("SELECT * FROM campaigns WHERE slug = 'fabio-garcia'").get();
  }

  const result = db.prepare(`
    INSERT INTO campaigns (slug, name, candidate, description, mission, status, accent_color, logo_url, whatsapp_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'fabio-garcia',
    'Campanha Fábio Garcia — Deputado Federal',
    'Fábio Garcia · Deputado Federal por Mato Grosso',
    'Mobilização federal em todo o Mato Grosso: território, lideranças e conversão digital.',
    'Articular os 142 municípios, conectar coordenadores e transformar presença em voto federal.',
    'ativa',
    '#0033A0',
    '/logos/fabio-garcia.png',
    'https://bit.ly/FalaFabio'
  );
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
}

/** Insere/atualiza os 142 municípios de MT sem apagar coordenadores já cadastrados */
function seedMunicipalities(db) {
  const municipalities = loadMunicipalities();
  const insert = db.prepare(`
    INSERT INTO municipalities (name, ibge_code, lat, lng, coordinator_name, coordinator_photo)
    VALUES (@name, @ibge_code, @lat, @lng, @coordinator_name, @coordinator_photo)
    ON CONFLICT(name) DO UPDATE SET
      ibge_code = excluded.ibge_code,
      lat = excluded.lat,
      lng = excluded.lng
  `);

  // sql.js may not support ON CONFLICT the same way - use check-then-insert
  const findByName = db.prepare('SELECT id FROM municipalities WHERE name = ?');
  const findByIbge = db.prepare('SELECT id FROM municipalities WHERE ibge_code = ?');
  const insertSimple = db.prepare(`
    INSERT INTO municipalities (name, ibge_code, lat, lng, coordinator_name, coordinator_photo)
    VALUES (@name, @ibge_code, @lat, @lng, @coordinator_name, @coordinator_photo)
  `);
  const updateCoords = db.prepare(`
    UPDATE municipalities SET ibge_code = ?, lat = ?, lng = ? WHERE id = ?
  `);

  let created = 0;
  let updated = 0;
  for (const m of municipalities) {
    const existing = findByName.get(m.name) || (m.ibge_code ? findByIbge.get(m.ibge_code) : null);
    if (existing) {
      updateCoords.run(m.ibge_code, m.lat, m.lng, existing.id);
      updated += 1;
    } else {
      insertSimple.run(m);
      created += 1;
    }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM municipalities').get().c;
  console.log(`Municípios MT: ${total} (novos: ${created}, atualizados: ${updated})`);
  return total;
}

function seedDemo(db) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM leaders').get().c;
  if (existing > 0) {
    console.log('Demo já possui lideranças. Pulando seed demo.');
    return;
  }

  ensureBaseCampaign(db);
  seedMunicipalities(db);
  const campaign = db.prepare("SELECT * FROM campaigns WHERE slug = 'fabio-garcia'").get();
  const campaignId = campaign.id;

  const munis = db.prepare('SELECT * FROM municipalities').all();
  const muniIds = Object.fromEntries(munis.map((m) => [m.name, m.id]));
  const municipalities = loadMunicipalities();

  const demoCoords = {
    Cuiabá: 'Ana Paula Ribeiro',
    Colíder: 'Ogeda',
    'Barra do Garças': 'Helena Costa',
    Sinop: 'Roberto Alves',
  };
  const updateCoord = db.prepare('UPDATE municipalities SET coordinator_name = ? WHERE id = ?');
  for (const [name, coord] of Object.entries(demoCoords)) {
    if (muniIds[name]) updateCoord.run(coord, muniIds[name]);
  }

  const insertLeader = db.prepare(`
    INSERT INTO leaders (campaign_id, municipality_id, name, photo_url, type, status, referral_code, phone, bio, mission_bonus)
    VALUES (@campaign_id, @municipality_id, @name, @photo_url, @type, @status, @referral_code, @phone, @bio, @mission_bonus)
  `);

  const leaders = [];
  for (const l of leaderDefs) {
    const code = nano();
    const r = insertLeader.run({
      campaign_id: campaignId,
      municipality_id: muniIds[l.muni],
      name: l.name,
      photo_url: null,
      type: l.type,
      status: l.status,
      referral_code: code,
      phone: randomPhone(),
      bio: `${l.type === 'politica' ? 'Liderança política' : 'Multiplicador'} em ${l.muni}.`,
      mission_bonus: Math.floor(Math.random() * 40),
    });
    leaders.push({ id: r.lastInsertRowid, code, muni: l.muni, status: l.status, type: l.type });
  }

  const insertReg = db.prepare(`
    INSERT INTO registrations (campaign_id, leader_id, municipality_id, full_name, phone, email, source, referral_code, lat, lng, created_at)
    VALUES (@campaign_id, @leader_id, @municipality_id, @full_name, @phone, @email, @source, @referral_code, @lat, @lng, @created_at)
  `);

  const weightByMuni = {
    Cuiabá: 55, 'Várzea Grande': 35, Rondonópolis: 40, Sinop: 32, 'Tangará da Serra': 22,
    Cáceres: 18, Sorriso: 28, 'Lucas do Rio Verde': 20, 'Barra do Garças': 25, 'Primavera do Leste': 18,
    Colíder: 30, 'Alta Floresta': 16, 'Pontes e Lacerda': 10, 'Nova Mutum': 14, 'Campo Verde': 12,
    'Guarantã do Norte': 8, Juína: 7, 'Água Boa': 11, 'Peixoto de Azevedo': 9, Confresa: 6,
  };

  const insertMany = db.transaction(() => {
    for (const [muniName, count] of Object.entries(weightByMuni)) {
      const muni = municipalities.find((m) => m.name === muniName);
      const muniLeaders = leaders.filter((l) => l.muni === muniName && l.status === 'ativo');
      const pool = muniLeaders.length ? muniLeaders : leaders.filter((l) => l.status === 'ativo');
      for (let i = 0; i < count; i++) {
        const leader = randomItem(pool);
        insertReg.run({
          campaign_id: campaignId,
          leader_id: leader.id,
          municipality_id: muniIds[muniName],
          full_name: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
          phone: randomPhone(),
          email: Math.random() > 0.4 ? `${nano()}@email.com` : null,
          source: `link/${leader.code}`,
          referral_code: leader.code,
          lat: jitter(muni.lat),
          lng: jitter(muni.lng),
          created_at: daysAgo(Math.floor(Math.random() * 45)),
        });
      }
    }
  });
  insertMany();

  console.log('Seed DEMO concluído (dados fictícios para teste).');
}

function seed(db) {
  ensureBaseCampaign(db);
  seedMunicipalities(db);
  seedDemo(db);
}

/** Migra nomes já salvos em municipalities.coordinator_name para a tabela coordinators. */
function migrateLegacyCoordinators(db) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE slug = 'fabio-garcia'").get();
  if (!campaign) return;

  const named = db.prepare(`
    SELECT id, coordinator_name FROM municipalities
    WHERE coordinator_name IS NOT NULL AND TRIM(coordinator_name) != ''
  `).all();

  const byName = new Map();
  for (const row of named) {
    const name = String(row.coordinator_name).trim();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(row.id);
  }

  for (const [name, muniIds] of byName.entries()) {
    let coord = db.prepare('SELECT * FROM coordinators WHERE campaign_id = ? AND name = ?')
      .get(campaign.id, name);
    if (!coord) {
      const r = db.prepare('INSERT INTO coordinators (campaign_id, name) VALUES (?, ?)')
        .run(campaign.id, name);
      coord = db.prepare('SELECT * FROM coordinators WHERE id = ?').get(r.lastInsertRowid);
    }

    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO coordinator_municipalities (coordinator_id, municipality_id)
      VALUES (?, ?)
    `);
    for (const mid of muniIds) {
      const owned = db.prepare(`
        SELECT cm.coordinator_id FROM coordinator_municipalities cm
        JOIN coordinators c ON c.id = cm.coordinator_id
        WHERE cm.municipality_id = ? AND c.campaign_id = ?
      `).get(mid, campaign.id);
      if (!owned) insertLink.run(coord.id, mid);
    }
  }
}

function seedProduction(db) {
  ensureBaseCampaign(db);
  seedMunicipalities(db);
  migrateLegacyCoordinators(db);
  // Dossiê NÃO sobe automático — equipe cola texto / Word / botão oficial
  console.log('Base pronta (campanha + 142 municípios). Sem nomes fake — alimente pelo /admin.');
}

/**
 * Importa o dossiê regional (emendas/viabilizações) se a campanha ainda não tiver itens.
 */
function seedDossierInvestments(db, { force = false } = {}) {
  const campaign = db.prepare("SELECT id FROM campaigns WHERE slug = 'fabio-garcia'").get();
  if (!campaign) return;

  const existing = db.prepare(
    'SELECT COUNT(*) AS c FROM campaign_investments WHERE campaign_id = ?'
  ).get(campaign.id);
  if (!force && existing?.c > 0) {
    console.log(`Dossiê de investimentos: já existem ${existing.c} itens — seed ignorado.`);
    return;
  }

  try {
    const { importDossier, loadOfficialDossierSeed } = require('./investment');
    const result = importDossier(db, campaign.id, loadOfficialDossierSeed());
    console.log(
      `Dossiê de investimentos: ${result.items_inserted} itens · ${result.municipalities_imported} municípios`
      + (result.municipalities_missing?.length
        ? ` · faltando: ${result.municipalities_missing.join(', ')}`
        : ''),
    );
  } catch (err) {
    console.warn('seed dossier:', err.message);
  }
}

module.exports = {
  seed,
  seedProduction,
  seedDemo,
  seedMunicipalities,
  loadMunicipalities,
  migrateLegacyCoordinators,
  seedDossierInvestments,
};
