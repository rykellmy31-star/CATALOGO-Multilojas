CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry ON auth_rate_limits(expires_at);
