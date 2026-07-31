function ensureColumn(db, table, column, definition) {
  if (db.dialect === 'postgres') {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    } catch (err) {
      console.warn(`migrate postgres ${table}.${column}:`, err.message);
    }
    return;
  }
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateAnalyticsSchema(db) {
  // Mobilizers (código pessoal) — criar antes da FK em registrations
  if (db.dialect === 'postgres') {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mobilizers (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        phone TEXT,
        notes TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, code)
      );
      CREATE TABLE IF NOT EXISTS team_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'equipe',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } else {
    db.exec(`
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
    `);
  }

  ensureColumn(db, 'coordinator_municipalities', 'vote_expectation', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'coordinator_municipalities', 'content_views_expected', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'coordinator_municipalities', 'content_views_actual', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'coordinator_municipalities', 'ig_comments', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'coordinator_municipalities', 'ig_reach', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'coordinator_municipalities', 'last_meta_sync', 'TEXT');
  ensureColumn(db, 'events', 'organizer_name', 'TEXT');
  ensureColumn(db, 'events', 'organizer_role', "TEXT DEFAULT 'mobilizer'");
  ensureColumn(db, 'events', 'coordinator_id', 'INTEGER');
  ensureColumn(db, 'event_registrations', 'organizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'organizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'mobilizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'mobilizer_id', 'INTEGER');

  // Índices que dependem de colunas novas (depois do ensureColumn)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_reg_mobilizer ON registrations(mobilizer_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mobilizers_campaign ON mobilizers(campaign_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mobilizers_code ON mobilizers(code)');
  } catch (err) {
    console.warn('migrate indexes:', err.message);
  }

  // Backfill: mobilizador do evento → coluna correta; organizador municipal fica livre
  try {
    const rows = db.prepare(`
      SELECT r.id, r.organizer_name, r.mobilizer_name, r.source, e.organizer_name AS event_mobilizer
      FROM registrations r
      JOIN events e ON r.source = ('evento/' || e.slug)
      WHERE (r.mobilizer_name IS NULL OR r.mobilizer_name = '')
        AND e.organizer_name IS NOT NULL
        AND e.organizer_name != ''
    `).all();
    const upd = db.prepare(`
      UPDATE registrations
      SET mobilizer_name = ?,
          organizer_name = CASE
            WHEN organizer_name IS NOT NULL AND organizer_name = ? THEN NULL
            ELSE organizer_name
          END
      WHERE id = ?
    `);
    for (const row of rows) {
      upd.run(row.event_mobilizer, row.event_mobilizer, row.id);
    }
  } catch (err) {
    console.warn('migrate mobilizer_name backfill:', err.message);
  }

  if (db.dialect !== 'postgres') {
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_meta_config (
        campaign_id INTEGER PRIMARY KEY,
        ig_user_id TEXT,
        ig_username TEXT,
        content_views_threshold REAL DEFAULT 0.5,
        vote_progress_threshold REAL DEFAULT 0.15,
        notes TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);
  }
}

module.exports = { migrateAnalyticsSchema, ensureColumn };
