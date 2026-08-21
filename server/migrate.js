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

function normalizePlaceName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Usa o Local/nome do evento (já preenchido com município) para:
 * 1) setar events.municipality_id
 * 2) colocar cadastros do evento no mapa (lat/lng + funnel)
 */
function backfillEventMunicipalitiesFromLocation(db) {
  const municipalities = db.prepare('SELECT id, name, lat, lng FROM municipalities').all();
  if (!municipalities.length) return;

  const byNorm = new Map();
  for (const m of municipalities) {
    const key = normalizePlaceName(m.name);
    if (key) byNorm.set(key, m);
  }

  function findMunicipality(event) {
    if (event.municipality_id) {
      return municipalities.find((m) => m.id === event.municipality_id) || null;
    }

    const locationKey = normalizePlaceName(event.location);
    if (locationKey && byNorm.has(locationKey)) return byNorm.get(locationKey);

    // "Reunião ... - Cláudia" / "Evento em Cuiabá"
    const haystack = normalizePlaceName(`${event.location || ''} ${event.name || ''}`);
    if (!haystack) return null;

    let best = null;
    let bestLen = 0;
    for (const [key, muni] of byNorm.entries()) {
      if (key.length < 3) continue;
      if (haystack === key || haystack.includes(` ${key} `) || haystack.endsWith(` ${key}`) || haystack.startsWith(`${key} `) || haystack.includes(key)) {
        if (key.length > bestLen) {
          best = muni;
          bestLen = key.length;
        }
      }
    }
    return best;
  }

  const events = db.prepare('SELECT * FROM events').all();
  const updEvent = db.prepare('UPDATE events SET municipality_id = ? WHERE id = ?');
  const regsStmt = db.prepare(`
    SELECT id, lat, lng, municipality_id, funnel
    FROM registrations
    WHERE source = ?
  `);
  const updReg = db.prepare(`
    UPDATE registrations SET
      municipality_id = ?,
      lat = ?,
      lng = ?,
      funnel = COALESCE(funnel, ?)
    WHERE id = ?
  `);

  let linkedEvents = 0;
  let linkedRegs = 0;

  for (const event of events) {
    const muni = findMunicipality(event);
    if (!muni) continue;

    if (!event.municipality_id) {
      updEvent.run(muni.id, event.id);
      linkedEvents += 1;
    }

    const funnel = event.organizer_role === 'coordinator' ? 'coordenador' : 'mobilizador';
    const regs = regsStmt.all(`evento/${event.slug}`);
    for (const reg of regs) {
      const needsGeo = reg.lat == null || reg.lng == null || !reg.municipality_id;
      const needsFunnel = !reg.funnel;
      if (!needsGeo && !needsFunnel) continue;
      const lat = reg.lat != null ? reg.lat : Number(muni.lat) + (Math.random() - 0.5) * 0.06;
      const lng = reg.lng != null ? reg.lng : Number(muni.lng) + (Math.random() - 0.5) * 0.06;
      updReg.run(muni.id, lat, lng, funnel, reg.id);
      linkedRegs += 1;
    }
  }

  if (linkedEvents || linkedRegs) {
    console.log(
      `Backfill eventos→mapa: ${linkedEvents} evento(s) com município, ${linkedRegs} cadastro(s) no calor`,
    );
  }
}

function migrateAnalyticsSchema(db) {
  // Tipo de coordenador: regional (território) | dobra (ex.: grupos em Cuiabá)
  try {
    ensureColumn(db, 'coordinators', 'coord_type', "TEXT DEFAULT 'regional'");
    // Backfill nulos
    try {
      db.prepare(`UPDATE coordinators SET coord_type = 'regional' WHERE coord_type IS NULL OR coord_type = ''`).run();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn('migrate coordinators.coord_type:', err.message);
  }

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
  ensureColumn(db, 'events', 'channel_link', 'TEXT');
  ensureColumn(db, 'events', 'channel_name', 'TEXT');
  ensureColumn(db, 'events', 'municipality_id', 'INTEGER');
  ensureColumn(db, 'event_registrations', 'organizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'organizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'mobilizer_name', 'TEXT');
  ensureColumn(db, 'registrations', 'mobilizer_id', 'INTEGER');
  ensureColumn(db, 'registrations', 'funnel', 'TEXT');

  // Índices que dependem de colunas novas (depois do ensureColumn)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_reg_mobilizer ON registrations(mobilizer_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reg_funnel ON registrations(funnel)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mobilizers_campaign ON mobilizers(campaign_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mobilizers_code ON mobilizers(code)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_muni ON events(municipality_id)');
  } catch (err) {
    console.warn('migrate indexes:', err.message);
  }

  // Backfill funis: liderança → coordenador; eventos → papel do evento; mobilizador → mobilizador
  try {
    db.prepare(`
      UPDATE registrations SET funnel = 'coordenador'
      WHERE funnel IS NULL AND leader_id IS NOT NULL
    `).run();
    db.prepare(`
      UPDATE registrations SET funnel = 'mobilizador'
      WHERE funnel IS NULL AND mobilizer_id IS NOT NULL
    `).run();
    db.prepare(`
      UPDATE registrations SET funnel = CASE
        WHEN e.organizer_role = 'coordinator' THEN 'coordenador'
        ELSE 'mobilizador'
      END
      FROM events e
      WHERE registrations.funnel IS NULL
        AND registrations.source = ('evento/' || e.slug)
    `).run();
  } catch (err) {
    // SQLite não tem UPDATE...FROM — fallback
    try {
      const eventRows = db.prepare(`
        SELECT r.id, e.organizer_role
        FROM registrations r
        JOIN events e ON r.source = ('evento/' || e.slug)
        WHERE r.funnel IS NULL
      `).all();
      const upd = db.prepare('UPDATE registrations SET funnel = ? WHERE id = ?');
      for (const row of eventRows) {
        upd.run(row.organizer_role === 'coordinator' ? 'coordenador' : 'mobilizador', row.id);
      }
    } catch (err2) {
      console.warn('migrate funnel backfill:', err2.message);
    }
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

  // Backfill: eventos com Local = nome do município → municipality_id + geo nos cadastros
  try {
    backfillEventMunicipalitiesFromLocation(db);
  } catch (err) {
    console.warn('migrate event municipality backfill:', err.message);
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
    `);
  } else {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS content_posts (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
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
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS content_assignments (
          id SERIAL PRIMARY KEY,
          content_post_id INTEGER NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
          coordinator_id INTEGER REFERENCES coordinators(id) ON DELETE SET NULL,
          municipality_id INTEGER REFERENCES municipalities(id) ON DELETE SET NULL,
          target_views INTEGER DEFAULT 0,
          actual_views INTEGER DEFAULT 0,
          target_comments INTEGER DEFAULT 0,
          actual_comments INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pendente',
          notes TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      console.warn('migrate content tables:', err.message);
    }
  }

  // Conteúdos mobilizados (Bitly + grupos/canais)
  try {
    if (db.dialect === 'postgres') {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mobilized_contents (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          bitly_url TEXT NOT NULL,
          destination_url TEXT,
          clicks INTEGER DEFAULT 0,
          clicks_30d INTEGER DEFAULT 0,
          clicks_series TEXT,
          views INTEGER DEFAULT 0,
          notes TEXT,
          status TEXT DEFAULT 'ativo',
          bitly_synced_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS mobilized_content_channels (
          id SERIAL PRIMARY KEY,
          mobilized_content_id INTEGER NOT NULL REFERENCES mobilized_contents(id) ON DELETE CASCADE,
          channel_type TEXT DEFAULT 'grupo',
          channel_name TEXT NOT NULL,
          members_count INTEGER DEFAULT 0,
          sent_at TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } else {
      db.exec(`
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
      `);
    }
  } catch (err) {
    console.warn('migrate mobilized contents:', err.message);
  }

  try {
    ensureColumn(db, 'mobilized_contents', 'clicks_30d', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'mobilized_contents', 'clicks_series', 'TEXT');
    ensureColumn(
      db,
      'mobilized_contents',
      'bitly_synced_at',
      db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'TEXT',
    );
  } catch (err) {
    console.warn('migrate mobilized analytics columns:', err.message);
  }

  // Funil de demandas territoriais (coordenador → município)
  try {
    if (db.dialect === 'postgres') {
      db.exec(`
        CREATE TABLE IF NOT EXISTS territory_demands (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          coordinator_id INTEGER NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
          municipality_id INTEGER NOT NULL REFERENCES municipalities(id),
          title TEXT,
          description TEXT NOT NULL,
          occurred_at TEXT,
          status TEXT DEFAULT 'standby',
          unresolved_reason TEXT,
          resolution_notes TEXT,
          resolved_at TIMESTAMPTZ,
          created_by TEXT,
          attachments TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } else {
      db.exec(`
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
        )
      `);
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_demands_campaign ON territory_demands(campaign_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_demands_coord ON territory_demands(coordinator_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_demands_muni ON territory_demands(municipality_id)');
  } catch (err) {
    console.warn('migrate territory_demands:', err.message);
  }

  // Snapshot da conta Instagram (totais reais, separados do rateio municipal)
  try {
    ensureColumn(db, 'campaign_meta_config', 'last_ig_sync_at', db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'TEXT');
    ensureColumn(db, 'campaign_meta_config', 'last_ig_totals', 'TEXT');
    ensureColumn(db, 'campaign_meta_config', 'prev_ig_totals', 'TEXT');
  } catch (err) {
    console.warn('migrate campaign_meta_config ig snapshot:', err.message);
  }

  // Bitly territorial + deltas
  try {
    ensureColumn(db, 'mobilized_contents', 'coordinator_id', 'INTEGER');
    ensureColumn(db, 'mobilized_contents', 'municipality_id', 'INTEGER');
    ensureColumn(db, 'mobilized_contents', 'content_post_id', 'INTEGER');
    ensureColumn(db, 'mobilized_contents', 'clicks_prev', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'mobilized_contents', 'bitly_last_error', 'TEXT');
  } catch (err) {
    console.warn('migrate mobilized territory:', err.message);
  }

  // Relatório de investimento (manual, por coordenador)
  try {
    if (db.dialect === 'postgres') {
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_investments (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          coordinator_id INTEGER REFERENCES coordinators(id) ON DELETE SET NULL,
          municipality_id INTEGER REFERENCES municipalities(id) ON DELETE SET NULL,
          category TEXT DEFAULT 'outros',
          description TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          invested_at TEXT,
          receipt_ref TEXT,
          notes TEXT,
          created_by TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_investment_muni_notes (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          municipality_id INTEGER NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
          footnote TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (campaign_id, municipality_id)
        )
      `);
    } else {
      db.exec(`
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
        )
      `);
      db.exec(`
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
        )
      `);
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_invest_campaign ON campaign_investments(campaign_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_invest_coord ON campaign_investments(coordinator_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_invest_muni ON campaign_investments(municipality_id)');
    ensureColumn(db, 'campaign_investments', 'sort_order', 'INTEGER DEFAULT 0');
  } catch (err) {
    console.warn('migrate campaign_investments:', err.message);
  }

  // Grupos WhatsApp criados via dobra (mobilização)
  try {
    if (db.dialect === 'postgres') {
      db.exec(`
        CREATE TABLE IF NOT EXISTS dobra_groups (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          photo_url TEXT,
          invite_link TEXT,
          bitly_url TEXT,
          destination_url TEXT,
          members_initial INTEGER DEFAULT 0,
          members_current INTEGER DEFAULT 0,
          coordinator_id INTEGER REFERENCES coordinators(id) ON DELETE SET NULL,
          coordinator_label TEXT,
          municipality_id INTEGER REFERENCES municipalities(id) ON DELETE SET NULL,
          notes TEXT,
          status TEXT DEFAULT 'ativo',
          opened_at TEXT,
          members_updated_at TIMESTAMPTZ,
          clicks INTEGER DEFAULT 0,
          clicks_30d INTEGER DEFAULT 0,
          clicks_series TEXT,
          bitly_synced_at TIMESTAMPTZ,
          bitly_last_error TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } else {
      db.exec(`
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
          FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
        )
      `);
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_dobra_groups_campaign ON dobra_groups(campaign_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dobra_groups_coord ON dobra_groups(coordinator_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dobra_groups_muni ON dobra_groups(municipality_id)');
    ensureColumn(db, 'dobra_groups', 'coordinator_label', 'TEXT');
  } catch (err) {
    console.warn('migrate dobra_groups:', err.message);
  }
}

module.exports = { migrateAnalyticsSchema, ensureColumn, backfillEventMunicipalitiesFromLocation };
