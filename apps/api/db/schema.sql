-- Users table
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,                        -- encrypted at rest
  role          TEXT DEFAULT 'operator',
  org_id        UUID REFERENCES orgs(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- Sessions table
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,             -- SHA-256 of JWT, never store raw
  ip_address      INET,
  user_agent      TEXT,
  device_score    INTEGER DEFAULT 0,         -- 0–80 device trust score
  geo_city        TEXT,
  geo_country     TEXT,
  geo_lat         DECIMAL(9,6),
  geo_lon         DECIMAL(9,6),
  is_geo_anomaly  BOOLEAN DEFAULT FALSE,
  adapted_timeout INTEGER DEFAULT 120,       -- seconds, recalculated live
  biometric_score INTEGER DEFAULT 100,
  status          TEXT DEFAULT 'active',     -- active | expired | killed | suspicious
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  last_activity   TIMESTAMPTZ DEFAULT now()
);

-- Session events (append-only, TimescaleDB hypertable)
CREATE TABLE session_events (
  time        TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  UUID REFERENCES sessions(id),
  user_id     UUID REFERENCES users(id),
  event_type  TEXT NOT NULL,
  severity    TEXT DEFAULT 'info',           -- info | warn | high
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  PRIMARY KEY (time, session_id)
);

-- Convert to TimescaleDB hypertable for time-series performance
SELECT create_hypertable('session_events', 'time');

-- Transactions table (logistics domain)
CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id),
  user_id       UUID REFERENCES users(id),
  txn_ref       TEXT UNIQUE NOT NULL,        -- e.g. TXN-9821
  txn_type      TEXT,                        -- Freight, Cold Chain, etc.
  amount_paise  BIGINT NOT NULL,             -- Store in smallest unit
  currency      TEXT DEFAULT 'INR',
  risk_level    TEXT DEFAULT 'LOW',          -- LOW | MEDIUM | HIGH
  status        TEXT DEFAULT 'PENDING',
  route_origin  TEXT,
  route_dest    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  authorized_at TIMESTAMPTZ,
  flagged_at    TIMESTAMPTZ,
  flagged_reason TEXT
);

-- Trusted geo-zones per org
CREATE TABLE geo_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES orgs(id),
  name        TEXT NOT NULL,
  lat         DECIMAL(9,6) NOT NULL,
  lon         DECIMAL(9,6) NOT NULL,
  radius_km   INTEGER DEFAULT 50,
  is_active   BOOLEAN DEFAULT TRUE
);

-- Device fingerprints (trusted devices per user)
CREATE TABLE trusted_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  fingerprint_hash TEXT NOT NULL,
  label           TEXT,                      -- e.g. "Chrome on MacBook"
  last_seen       TIMESTAMPTZ DEFAULT now(),
  trust_granted_at TIMESTAMPTZ DEFAULT now(),
  is_revoked      BOOLEAN DEFAULT FALSE
);
