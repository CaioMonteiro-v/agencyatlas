const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'atlas.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      candidate TEXT,
      description TEXT,
      mission TEXT,
      status TEXT DEFAULT 'ativa',
      accent_color TEXT DEFAULT '#7BA3B8',
      logo_url TEXT,
      whatsapp_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS municipalities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      ibge_code TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      coordinator_name TEXT,
      coordinator_photo TEXT
    );

    CREATE TABLE IF NOT EXISTS leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      municipality_id INTEGER,
      name TEXT NOT NULL,
      photo_url TEXT,
      type TEXT NOT NULL CHECK(type IN ('politica', 'multiplicador')),
      status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
      referral_code TEXT UNIQUE NOT NULL,
      phone TEXT,
      bio TEXT,
      mission_bonus INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      leader_id INTEGER,
      municipality_id INTEGER,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      source TEXT,
      referral_code TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id),
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      event_date TEXT NOT NULL,
      event_time TEXT,
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      connect_whatsapp INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target INTEGER NOT NULL DEFAULT 100,
      progress INTEGER DEFAULT 0,
      municipality_id INTEGER,
      status TEXT DEFAULT 'ativa' CHECK(status IN ('ativa', 'concluida', 'pausada')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    );

    CREATE TABLE IF NOT EXISTS mission_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      leader_id INTEGER NOT NULL,
      contribution INTEGER DEFAULT 0,
      UNIQUE(mission_id, leader_id),
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reg_campaign ON registrations(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_reg_leader ON registrations(leader_id);
    CREATE INDEX IF NOT EXISTS idx_reg_muni ON registrations(municipality_id);
    CREATE INDEX IF NOT EXISTS idx_leaders_campaign ON leaders(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_leaders_code ON leaders(referral_code);
  `);
}

initSchema();

module.exports = db;
