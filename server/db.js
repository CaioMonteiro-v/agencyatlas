const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { toPositional } = require('./sql-utils');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'atlas.db');

function persist(rawDb) {
  const data = rawDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function createSqlJsApi(rawDb) {
  let dirty = false;
  let inTx = false;

  function flush() {
    if (!dirty || inTx) return;
    persist(rawDb);
    dirty = false;
  }

  function prepare(sql) {
    return {
      get(...params) {
        const converted = toPositional(sql, params);
        const stmt = rawDb.prepare(converted.sql);
        try {
          if (converted.values.length) stmt.bind(converted.values);
          if (stmt.step()) return stmt.getAsObject();
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const converted = toPositional(sql, params);
        const stmt = rawDb.prepare(converted.sql);
        const rows = [];
        try {
          if (converted.values.length) stmt.bind(converted.values);
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        const converted = toPositional(sql, params);
        rawDb.run(converted.sql, converted.values.length ? converted.values : []);
        dirty = true;
        const idRes = rawDb.exec('SELECT last_insert_rowid() AS id');
        const lastInsertRowid = idRes[0] ? idRes[0].values[0][0] : 0;
        const changes = rawDb.getRowsModified();
        flush();
        return { lastInsertRowid, changes };
      },
    };
  }

  return {
    dialect: 'sqlite',
    prepare,
    exec(sql) {
      rawDb.exec(sql);
      dirty = true;
      flush();
    },
    pragma() {},
    transaction(fn) {
      return (...args) => {
        rawDb.run('BEGIN');
        inTx = true;
        try {
          const result = fn(...args);
          rawDb.run('COMMIT');
          inTx = false;
          dirty = true;
          flush();
          return result;
        } catch (err) {
          try { rawDb.run('ROLLBACK'); } catch (_) { /* ignore */ }
          inTx = false;
          throw err;
        }
      };
    },
  };
}

function initSqliteSchema(db) {
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

    CREATE TABLE IF NOT EXISTS mobilizers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(campaign_id, code),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'equipe',
      created_at TEXT DEFAULT (datetime('now'))
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
      organizer_name TEXT,
      mobilizer_name TEXT,
      mobilizer_id INTEGER,
      funnel TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id),
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id),
      FOREIGN KEY (mobilizer_id) REFERENCES mobilizers(id) ON DELETE SET NULL
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
      organizer_name TEXT,
      organizer_role TEXT DEFAULT 'mobilizer',
      coordinator_id INTEGER,
      channel_link TEXT,
      channel_name TEXT,
      municipality_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      connect_whatsapp INTEGER DEFAULT 0,
      organizer_name TEXT,
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

    CREATE TABLE IF NOT EXISTS coordinators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      photo_url TEXT,
      notes TEXT,
      coord_type TEXT DEFAULT 'regional',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coordinator_municipalities (
      coordinator_id INTEGER NOT NULL,
      municipality_id INTEGER NOT NULL,
      vote_expectation INTEGER DEFAULT 0,
      content_views_expected INTEGER DEFAULT 0,
      content_views_actual INTEGER DEFAULT 0,
      ig_comments INTEGER DEFAULT 0,
      ig_reach INTEGER DEFAULT 0,
      last_meta_sync TEXT,
      PRIMARY KEY (coordinator_id, municipality_id),
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE CASCADE,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    );

    CREATE TABLE IF NOT EXISTS content_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      caption TEXT,
      permalink TEXT,
      posted_at TEXT,
      source TEXT DEFAULT 'manual',
      meta_media_id TEXT,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ativa',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_post_id INTEGER NOT NULL,
      coordinator_id INTEGER,
      municipality_id INTEGER,
      target_views INTEGER DEFAULT 0,
      actual_views INTEGER DEFAULT 0,
      target_comments INTEGER DEFAULT 0,
      actual_comments INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (content_post_id) REFERENCES content_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS mobilized_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      bitly_url TEXT NOT NULL,
      destination_url TEXT,
      clicks INTEGER DEFAULT 0,
      clicks_30d INTEGER DEFAULT 0,
      clicks_series TEXT,
      views INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'ativo',
      bitly_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mobilized_content_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobilized_content_id INTEGER NOT NULL,
      channel_type TEXT DEFAULT 'grupo',
      channel_name TEXT NOT NULL,
      members_count INTEGER DEFAULT 0,
      sent_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (mobilized_content_id) REFERENCES mobilized_contents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS territory_demands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      coordinator_id INTEGER NOT NULL,
      municipality_id INTEGER NOT NULL,
      title TEXT,
      description TEXT NOT NULL,
      occurred_at TEXT,
      status TEXT DEFAULT 'standby',
      unresolved_reason TEXT,
      resolution_notes TEXT,
      resolved_at TEXT,
      created_by TEXT,
      attachments TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE CASCADE,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    );

    CREATE TABLE IF NOT EXISTS campaign_investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      coordinator_id INTEGER,
      municipality_id INTEGER,
      category TEXT DEFAULT 'outros',
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      invested_at TEXT,
      receipt_ref TEXT,
      notes TEXT,
      created_by TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_investment_muni_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      municipality_id INTEGER NOT NULL,
      footnote TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (campaign_id, municipality_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dobra_deputies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      campaign_coordinator_id INTEGER,
      dobra_coordinator_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (dobra_coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS dobra_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT,
      invite_link TEXT,
      bitly_url TEXT,
      destination_url TEXT,
      members_initial INTEGER DEFAULT 0,
      members_current INTEGER DEFAULT 0,
      coordinator_id INTEGER,
      coordinator_label TEXT,
      deputy_name TEXT,
      deputy_id INTEGER,
      campaign_coordinator_id INTEGER,
      dobra_coordinator_id INTEGER,
      municipality_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'ativo',
      opened_at TEXT,
      members_updated_at TEXT,
      clicks INTEGER DEFAULT 0,
      clicks_30d INTEGER DEFAULT 0,
      clicks_series TEXT,
      bitly_synced_at TEXT,
      bitly_last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (deputy_id) REFERENCES dobra_deputies(id) ON DELETE SET NULL,
      FOREIGN KEY (campaign_coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (dobra_coordinator_id) REFERENCES coordinators(id) ON DELETE SET NULL,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reg_campaign ON registrations(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_reg_leader ON registrations(leader_id);
    CREATE INDEX IF NOT EXISTS idx_reg_muni ON registrations(municipality_id);
    CREATE INDEX IF NOT EXISTS idx_leaders_campaign ON leaders(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_leaders_code ON leaders(referral_code);
    CREATE INDEX IF NOT EXISTS idx_coord_campaign ON coordinators(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_demands_campaign ON territory_demands(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_demands_coord ON territory_demands(coordinator_id);
    CREATE INDEX IF NOT EXISTS idx_demands_muni ON territory_demands(municipality_id);
    CREATE INDEX IF NOT EXISTS idx_invest_campaign ON campaign_investments(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_invest_coord ON campaign_investments(coordinator_id);
    CREATE INDEX IF NOT EXISTS idx_invest_muni ON campaign_investments(municipality_id);
    CREATE INDEX IF NOT EXISTS idx_dobra_groups_campaign ON dobra_groups(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_dobra_groups_coord ON dobra_groups(coordinator_id);
    CREATE INDEX IF NOT EXISTS idx_dobra_groups_muni ON dobra_groups(municipality_id);
    CREATE INDEX IF NOT EXISTS idx_dobra_deputies_campaign ON dobra_deputies(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_dobra_groups_deputy ON dobra_groups(deputy_id);
  `);
}

let dbPromise;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
      if (databaseUrl) {
        const { createPgDb } = require('./pg');
        const db = createPgDb(databaseUrl);
        db.initSchema();
        const { migrateAnalyticsSchema } = require('./migrate');
        migrateAnalyticsSchema(db);
        console.log('Banco: Postgres/Supabase conectado via DATABASE_URL');
        return db;
      }

      const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      const SQL = await initSqlJs({ locateFile: () => wasmPath });

      let rawDb;
      if (fs.existsSync(dbPath)) {
        try {
          rawDb = new SQL.Database(fs.readFileSync(dbPath));
          rawDb.exec('SELECT 1');
        } catch (err) {
          console.warn('Banco anterior incompatível. Recriando...', err.message);
          rawDb = new SQL.Database();
        }
      } else {
        rawDb = new SQL.Database();
      }

      const db = createSqlJsApi(rawDb);
      try { rawDb.run('PRAGMA foreign_keys = ON'); } catch (_) { /* ignore */ }
      initSqliteSchema(db);
      const { migrateAnalyticsSchema } = require('./migrate');
      migrateAnalyticsSchema(db);
      console.log('Banco: SQLite local — configure DATABASE_URL (Supabase) para persistir em produção');
      return db;
    })();
  }
  return dbPromise;
}

module.exports = { getDb, dbPath };
