const { customAlphabet } = require('nanoid');
const db = require('./db');

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const municipalities = [
  { name: 'Cuiabá', ibge_code: '5103403', lat: -15.601, lng: -56.0979, coordinator_name: 'Ana Paula Ribeiro', coordinator_photo: null },
  { name: 'Várzea Grande', ibge_code: '5108402', lat: -15.6467, lng: -56.1326, coordinator_name: 'Marcos Tavares', coordinator_photo: null },
  { name: 'Rondonópolis', ibge_code: '5107602', lat: -16.4673, lng: -54.6372, coordinator_name: 'Luciana Mendes', coordinator_photo: null },
  { name: 'Sinop', ibge_code: '5107909', lat: -11.8609, lng: -55.5091, coordinator_name: 'Roberto Alves', coordinator_photo: null },
  { name: 'Tangará da Serra', ibge_code: '5107958', lat: -14.6229, lng: -57.4934, coordinator_name: 'Patrícia Souza', coordinator_photo: null },
  { name: 'Cáceres', ibge_code: '5102504', lat: -16.0764, lng: -57.6818, coordinator_name: 'João Batista', coordinator_photo: null },
  { name: 'Sorriso', ibge_code: '5107925', lat: -12.5425, lng: -55.7211, coordinator_name: 'Fernanda Lima', coordinator_photo: null },
  { name: 'Lucas do Rio Verde', ibge_code: '5105259', lat: -13.0588, lng: -55.9042, coordinator_name: 'Carlos Eduardo', coordinator_photo: null },
  { name: 'Barra do Garças', ibge_code: '5101803', lat: -15.8903, lng: -52.2567, coordinator_name: 'Helena Costa', coordinator_photo: null },
  { name: 'Primavera do Leste', ibge_code: '5107040', lat: -15.5566, lng: -54.2969, coordinator_name: 'Diego Martins', coordinator_photo: null },
  { name: 'Colíder', ibge_code: '5103205', lat: -10.8136, lng: -55.4608, coordinator_name: 'Ogeda', coordinator_photo: null },
  { name: 'Alta Floresta', ibge_code: '5100250', lat: -9.8665, lng: -56.0862, coordinator_name: 'Simone Araújo', coordinator_photo: null },
  { name: 'Pontes e Lacerda', ibge_code: '5106752', lat: -15.2262, lng: -59.3352, coordinator_name: 'Paulo Henrique', coordinator_photo: null },
  { name: 'Nova Mutum', ibge_code: '5106224', lat: -13.8373, lng: -56.0743, coordinator_name: 'Camila Rocha', coordinator_photo: null },
  { name: 'Campo Verde', ibge_code: '5102678', lat: -15.5452, lng: -55.1623, coordinator_name: 'André Nunes', coordinator_photo: null },
  { name: 'Guarantã do Norte', ibge_code: '5104104', lat: -9.9621, lng: -54.9121, coordinator_name: 'Márcia Oliveira', coordinator_photo: null },
  { name: 'Juína', ibge_code: '5105150', lat: -11.3728, lng: -58.7483, coordinator_name: 'Ricardo Pinto', coordinator_photo: null },
  { name: 'Água Boa', ibge_code: '5100201', lat: -14.051, lng: -52.1601, coordinator_name: 'Beatriz Campos', coordinator_photo: null },
  { name: 'Peixoto de Azevedo', ibge_code: '5106505', lat: -10.23, lng: -54.9792, coordinator_name: 'Gustavo Ferreira', coordinator_photo: null },
  { name: 'Confresa', ibge_code: '5103353', lat: -10.6437, lng: -51.5699, coordinator_name: 'Eliane Dias', coordinator_photo: null },
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

function seed() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM campaigns').get().c;
  if (existing > 0) {
    console.log('Banco já possui dados. Pulando seed.');
    return;
  }

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (slug, name, candidate, description, mission, status, accent_color, logo_url, whatsapp_url)
    VALUES (@slug, @name, @candidate, @description, @mission, @status, @accent_color, @logo_url, @whatsapp_url)
  `);

  const campaign = insertCampaign.run({
    slug: 'fabio-garcia',
    name: 'Campanha Fábio Garcia',
    candidate: 'Fábio Garcia',
    description: 'Mobilização digital e articulação territorial em Mato Grosso, com foco em escuta, presença e crescimento orgânico de apoiadores.',
    mission: 'Conectar lideranças, multiplicadores e comunidades em todo o estado com ferramentas claras de mobilização, acompanhamento e cuidado.',
    status: 'ativa',
    accent_color: '#0033A0',
    logo_url: '/logos/fabio-garcia.png',
    whatsapp_url: 'https://bit.ly/FalaFabio',
  });

  const campaignId = campaign.lastInsertRowid;

  insertCampaign.run({
    slug: 'mobilizacao-juventude',
    name: 'Mobilização Juventude',
    candidate: 'Projeto Atlas',
    description: 'Rede de engajamento jovem para causas locais, formação de multiplicadores e presença digital responsável.',
    mission: 'Formar uma geração de lideranças que mobilizam com empatia e responsabilidade.',
    status: 'planejamento',
    accent_color: '#8FB5A5',
    logo_url: '/logos/atlas-agency.png',
    whatsapp_url: 'https://bit.ly/FalaFabio',
  });

  const insertMuni = db.prepare(`
    INSERT INTO municipalities (name, ibge_code, lat, lng, coordinator_name, coordinator_photo)
    VALUES (@name, @ibge_code, @lat, @lng, @coordinator_name, @coordinator_photo)
  `);

  const muniIds = {};
  for (const m of municipalities) {
    const r = insertMuni.run(m);
    muniIds[m.name] = r.lastInsertRowid;
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
    leaders.push({
      id: r.lastInsertRowid,
      code,
      muni: l.muni,
      status: l.status,
      type: l.type,
    });
  }

  const insertReg = db.prepare(`
    INSERT INTO registrations (campaign_id, leader_id, municipality_id, full_name, phone, email, source, referral_code, lat, lng, created_at)
    VALUES (@campaign_id, @leader_id, @municipality_id, @full_name, @phone, @email, @source, @referral_code, @lat, @lng, @created_at)
  `);

  const weightByMuni = {
    Cuiabá: 55,
    'Várzea Grande': 35,
    Rondonópolis: 40,
    Sinop: 32,
    'Tangará da Serra': 22,
    Cáceres: 18,
    Sorriso: 28,
    'Lucas do Rio Verde': 20,
    'Barra do Garças': 25,
    'Primavera do Leste': 18,
    Colíder: 30,
    'Alta Floresta': 16,
    'Pontes e Lacerda': 10,
    'Nova Mutum': 14,
    'Campo Verde': 12,
    'Guarantã do Norte': 8,
    Juína: 7,
    'Água Boa': 11,
    'Peixoto de Azevedo': 9,
    Confresa: 6,
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

  const insertEvent = db.prepare(`
    INSERT INTO events (campaign_id, name, description, location, event_date, event_time, slug)
    VALUES (@campaign_id, @name, @description, @location, @event_date, @event_time, @slug)
  `);

  const events = [
    {
      name: 'Encontro de Lideranças — Cuiabá',
      description: 'Conversa aberta com lideranças da capital sobre prioridades locais e próximos passos da mobilização.',
      location: 'Centro de Eventos Pantanal, Cuiabá',
      event_date: '2026-08-15',
      event_time: '19:00',
      slug: 'encontro-cuiaba-2026',
    },
    {
      name: 'Café com Multiplicadores — Sinop',
      description: 'Manhã de formação prática para multiplicadores do norte do estado.',
      location: 'Espaço Comunitário Sinop',
      event_date: '2026-08-22',
      event_time: '09:30',
      slug: 'cafe-sinop-2026',
    },
    {
      name: 'Mutirão Digital — Barra do Garças',
      description: 'Oficina de compartilhamento responsável e cadastro presencial com QR Code.',
      location: 'Praça das Três Fronteiras, Barra do Garças',
      event_date: '2026-09-05',
      event_time: '16:00',
      slug: 'mutirao-barra-2026',
    },
  ];

  for (const e of events) {
    insertEvent.run({ campaign_id: campaignId, ...e });
  }

  const insertMission = db.prepare(`
    INSERT INTO missions (campaign_id, title, description, target, progress, municipality_id, status)
    VALUES (@campaign_id, @title, @description, @target, @progress, @municipality_id, @status)
  `);

  const insertAssign = db.prepare(`
    INSERT INTO mission_assignments (mission_id, leader_id, contribution)
    VALUES (@mission_id, @leader_id, @contribution)
  `);

  const mission1 = insertMission.run({
    campaign_id: campaignId,
    title: 'Missão Barra do Garças: 100 pessoas no vídeo X',
    description: 'Mobilizar a maior audiência local possível no vídeo de apresentação da agenda para Barra do Garças.',
    target: 100,
    progress: 67,
    municipality_id: muniIds['Barra do Garças'],
    status: 'ativa',
  });

  const mission2 = insertMission.run({
    campaign_id: campaignId,
    title: 'Missão Colíder: 80 novos cadastros',
    description: 'Ampliar a base de apoiadores em Colíder com foco em bairros e comunidades rurais.',
    target: 80,
    progress: 52,
    municipality_id: muniIds.Colíder,
    status: 'ativa',
  });

  const mission3 = insertMission.run({
    campaign_id: campaignId,
    title: 'Missão Cuiabá: presença em 12 bairros',
    description: 'Garantir ao menos uma liderança ativa e cadastros rastreados em 12 bairros da capital.',
    target: 12,
    progress: 9,
    municipality_id: muniIds.Cuiabá,
    status: 'ativa',
  });

  const barraLeaders = leaders.filter((l) => l.muni === 'Barra do Garças');
  const coliderLeaders = leaders.filter((l) => l.muni === 'Colíder');
  const cuiabaLeaders = leaders.filter((l) => l.muni === 'Cuiabá');

  for (const l of barraLeaders) {
    insertAssign.run({ mission_id: mission1.lastInsertRowid, leader_id: l.id, contribution: Math.floor(Math.random() * 40) + 10 });
  }
  for (const l of coliderLeaders) {
    insertAssign.run({ mission_id: mission2.lastInsertRowid, leader_id: l.id, contribution: Math.floor(Math.random() * 30) + 5 });
  }
  for (const l of cuiabaLeaders.slice(0, 3)) {
    insertAssign.run({ mission_id: mission3.lastInsertRowid, leader_id: l.id, contribution: Math.floor(Math.random() * 4) + 1 });
  }

  console.log('Seed concluído com sucesso.');
  console.log(`Campanha principal: fabio-garcia (id ${campaignId})`);
  console.log(`Municípios: ${municipalities.length}`);
  console.log(`Lideranças: ${leaders.length}`);
}

seed();
