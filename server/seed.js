const { customAlphabet } = require('nanoid');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const municipalities = [
  { name: 'Cuiabá', ibge_code: '5103403', lat: -15.601, lng: -56.0979, coordinator_name: null, coordinator_photo: null },
  { name: 'Várzea Grande', ibge_code: '5108402', lat: -15.6467, lng: -56.1326, coordinator_name: null, coordinator_photo: null },
  { name: 'Rondonópolis', ibge_code: '5107602', lat: -16.4673, lng: -54.6372, coordinator_name: null, coordinator_photo: null },
  { name: 'Sinop', ibge_code: '5107909', lat: -11.8609, lng: -55.5091, coordinator_name: null, coordinator_photo: null },
  { name: 'Tangará da Serra', ibge_code: '5107958', lat: -14.6229, lng: -57.4934, coordinator_name: null, coordinator_photo: null },
  { name: 'Cáceres', ibge_code: '5102504', lat: -16.0764, lng: -57.6818, coordinator_name: null, coordinator_photo: null },
  { name: 'Sorriso', ibge_code: '5107925', lat: -12.5425, lng: -55.7211, coordinator_name: null, coordinator_photo: null },
  { name: 'Lucas do Rio Verde', ibge_code: '5105259', lat: -13.0588, lng: -55.9042, coordinator_name: null, coordinator_photo: null },
  { name: 'Barra do Garças', ibge_code: '5101803', lat: -15.8903, lng: -52.2567, coordinator_name: null, coordinator_photo: null },
  { name: 'Primavera do Leste', ibge_code: '5107040', lat: -15.5566, lng: -54.2969, coordinator_name: null, coordinator_photo: null },
  { name: 'Colíder', ibge_code: '5103205', lat: -10.8136, lng: -55.4608, coordinator_name: null, coordinator_photo: null },
  { name: 'Alta Floresta', ibge_code: '5100250', lat: -9.8665, lng: -56.0862, coordinator_name: null, coordinator_photo: null },
  { name: 'Pontes e Lacerda', ibge_code: '5106752', lat: -15.2262, lng: -59.3352, coordinator_name: null, coordinator_photo: null },
  { name: 'Nova Mutum', ibge_code: '5106224', lat: -13.8373, lng: -56.0743, coordinator_name: null, coordinator_photo: null },
  { name: 'Campo Verde', ibge_code: '5102678', lat: -15.5452, lng: -55.1623, coordinator_name: null, coordinator_photo: null },
  { name: 'Guarantã do Norte', ibge_code: '5104104', lat: -9.9621, lng: -54.9121, coordinator_name: null, coordinator_photo: null },
  { name: 'Juína', ibge_code: '5105150', lat: -11.3728, lng: -58.7483, coordinator_name: null, coordinator_photo: null },
  { name: 'Água Boa', ibge_code: '5100201', lat: -14.051, lng: -52.1601, coordinator_name: null, coordinator_photo: null },
  { name: 'Peixoto de Azevedo', ibge_code: '5106505', lat: -10.23, lng: -54.9792, coordinator_name: null, coordinator_photo: null },
  { name: 'Confresa', ibge_code: '5103353', lat: -10.6437, lng: -51.5699, coordinator_name: null, coordinator_photo: null },
];

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
  if (campaign) return campaign;

  const result = db.prepare(`
    INSERT INTO campaigns (slug, name, candidate, description, mission, status, accent_color, logo_url, whatsapp_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'fabio-garcia',
    'Campanha Fábio Garcia',
    'Fábio Garcia',
    'Mobilização digital e articulação territorial em Mato Grosso.',
    'Conectar lideranças, multiplicadores e comunidades em todo o estado.',
    'ativa',
    '#0033A0',
    '/logos/fabio-garcia.png',
    'https://bit.ly/FalaFabio'
  );
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
}

function seedMunicipalities(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM municipalities').get().c;
  if (count > 0) return;

  const insertMuni = db.prepare(`
    INSERT INTO municipalities (name, ibge_code, lat, lng, coordinator_name, coordinator_photo)
    VALUES (@name, @ibge_code, @lat, @lng, @coordinator_name, @coordinator_photo)
  `);
  for (const m of municipalities) insertMuni.run(m);
  console.log(`Municípios base criados: ${municipalities.length}`);
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

  // Demo coordinators
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

function seedProduction(db) {
  ensureBaseCampaign(db);
  seedMunicipalities(db);
  console.log('Base pronta (campanha + municípios). Sem nomes fake — alimente pelo /admin.');
}

module.exports = { seed, seedProduction, seedDemo, seedMunicipalities };
