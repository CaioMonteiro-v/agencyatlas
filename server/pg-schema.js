const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  candidate TEXT,
  description TEXT,
  mission TEXT,
  status TEXT DEFAULT 'ativa',
  accent_color TEXT DEFAULT '#7BA3B8',
  logo_url TEXT,
  whatsapp_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipalities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  ibge_code TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  coordinator_name TEXT,
  coordinator_photo TEXT
);

CREATE TABLE IF NOT EXISTS leaders (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  municipality_id INTEGER REFERENCES municipalities(id),
  name TEXT NOT NULL,
  photo_url TEXT,
  type TEXT NOT NULL CHECK(type IN ('politica', 'multiplicador')),
  status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
  referral_code TEXT UNIQUE NOT NULL,
  phone TEXT,
  bio TEXT,
  mission_bonus INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  leader_id INTEGER REFERENCES leaders(id),
  municipality_id INTEGER REFERENCES municipalities(id),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT,
  referral_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  organizer_name TEXT,
  mobilizer_name TEXT,
  mobilizer_id INTEGER REFERENCES mobilizers(id) ON DELETE SET NULL,
  funnel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TEXT NOT NULL,
  event_time TEXT,
  slug TEXT UNIQUE NOT NULL,
  organizer_name TEXT,
  organizer_role TEXT DEFAULT 'mobilizer',
  coordinator_id INTEGER REFERENCES coordinators(id) ON DELETE SET NULL,
  channel_link TEXT,
  channel_name TEXT,
  municipality_id INTEGER REFERENCES municipalities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  connect_whatsapp INTEGER DEFAULT 0,
  organizer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target INTEGER NOT NULL DEFAULT 100,
  progress INTEGER DEFAULT 0,
  municipality_id INTEGER REFERENCES municipalities(id),
  status TEXT DEFAULT 'ativa' CHECK(status IN ('ativa', 'concluida', 'pausada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_assignments (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  leader_id INTEGER NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  contribution INTEGER DEFAULT 0,
  UNIQUE(mission_id, leader_id)
);

CREATE TABLE IF NOT EXISTS coordinators (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  notes TEXT,
  coord_type TEXT DEFAULT 'regional',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coordinator_municipalities (
  coordinator_id INTEGER NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
  municipality_id INTEGER NOT NULL REFERENCES municipalities(id),
  vote_expectation INTEGER DEFAULT 0,
  content_views_expected INTEGER DEFAULT 0,
  content_views_actual INTEGER DEFAULT 0,
  ig_comments INTEGER DEFAULT 0,
  ig_reach INTEGER DEFAULT 0,
  last_meta_sync TEXT,
  PRIMARY KEY (coordinator_id, municipality_id)
);

CREATE TABLE IF NOT EXISTS campaign_meta_config (
  campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  ig_user_id TEXT,
  ig_username TEXT,
  content_views_threshold DOUBLE PRECISION DEFAULT 0.5,
  vote_progress_threshold DOUBLE PRECISION DEFAULT 0.15,
  notes TEXT,
  last_ig_sync_at TIMESTAMPTZ,
  last_ig_totals TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS mobilized_content_channels (
  id SERIAL PRIMARY KEY,
  mobilized_content_id INTEGER NOT NULL REFERENCES mobilized_contents(id) ON DELETE CASCADE,
  channel_type TEXT DEFAULT 'grupo',
  channel_name TEXT NOT NULL,
  members_count INTEGER DEFAULT 0,
  sent_at TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
);

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
);

CREATE TABLE IF NOT EXISTS campaign_investment_muni_notes (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  municipality_id INTEGER NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  footnote TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, municipality_id)
);

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
);

CREATE INDEX IF NOT EXISTS idx_reg_campaign ON registrations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reg_leader ON registrations(leader_id);
CREATE INDEX IF NOT EXISTS idx_reg_muni ON registrations(municipality_id);
CREATE INDEX IF NOT EXISTS idx_leaders_campaign ON leaders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leaders_code ON leaders(referral_code);
CREATE INDEX IF NOT EXISTS idx_coord_campaign ON coordinators(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mobilizers_campaign ON mobilizers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mobilizers_code ON mobilizers(code);
CREATE INDEX IF NOT EXISTS idx_demands_campaign ON territory_demands(campaign_id);
CREATE INDEX IF NOT EXISTS idx_demands_coord ON territory_demands(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_demands_muni ON territory_demands(municipality_id);
CREATE INDEX IF NOT EXISTS idx_invest_campaign ON campaign_investments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_invest_coord ON campaign_investments(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_invest_muni ON campaign_investments(municipality_id);
CREATE INDEX IF NOT EXISTS idx_dobra_groups_campaign ON dobra_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dobra_groups_coord ON dobra_groups(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_dobra_groups_muni ON dobra_groups(municipality_id);
`;

module.exports = { PG_SCHEMA };
