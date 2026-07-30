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
