-- ============================================
-- CATÁLOGOS SAAS - SCHEMA COMPLETO D1 (SQLite)
-- Multi-tenant Isolation + Audit + IA + Analytics
-- ============================================


-- =====================
-- PLATFORM CONFIG
-- =====================
CREATE TABLE IF NOT EXISTS platform_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  platform_name TEXT NOT NULL DEFAULT 'Catálogos Pro',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0ea5e9',
  secondary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#f59e0b',
  footer_text TEXT DEFAULT 'Sistema desenvolvido por Catálogos Pro',
  support_email TEXT,
  ai_provider TEXT DEFAULT 'openai',
  ai_enabled INTEGER DEFAULT 1,
  ai_daily_limit_default INTEGER DEFAULT 10,
  ai_monthly_limit_default INTEGER DEFAULT 100,
  storage_limit_per_store_mb INTEGER DEFAULT 1024,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================
-- STORES (LOJAS)
-- =====================
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#0ea5e9',
  secondary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#f59e0b',
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'deleted')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  storage_used_mb REAL DEFAULT 0,
  storage_limit_mb INTEGER DEFAULT 1024,
  ai_enabled INTEGER DEFAULT 1,
  ai_daily_limit INTEGER DEFAULT 10,
  ai_monthly_limit INTEGER DEFAULT 100,
  ai_credits_used INTEGER DEFAULT 0,
  custom_domain TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- =====================
-- USERS
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'store_admin')),
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  email_verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK ((role = 'super_admin' AND store_id IS NULL) OR (role = 'store_admin' AND store_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================
-- CATEGORIES
-- =====================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  icon TEXT,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(store_id, slug);

-- =====================
-- BRANDS
-- =====================
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_brands_store ON brands(store_id);

-- =====================
-- PRODUCTS
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  original_price REAL,
  promotional_price REAL,
  cost_price REAL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'out_of_stock')),
  is_featured INTEGER DEFAULT 0,
  is_on_sale INTEGER DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  stock_unlimited INTEGER DEFAULT 1,
  weight REAL,
  dimensions TEXT, -- JSON: {width, height, depth, unit}
  technical_specs TEXT, -- JSON
  variations TEXT, -- JSON: [{color, model, sku, price}]
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  published_at TEXT,
  UNIQUE(store_id, slug),
  UNIQUE(store_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(store_id, is_featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(store_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- Full text search (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, short_description, description, sku,
  content='products',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS products_fts_insert AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, short_description, description, sku)
  VALUES (new.rowid, new.name, new.short_description, new.description, new.sku);
END;
CREATE TRIGGER IF NOT EXISTS products_fts_delete AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, short_description, description, sku)
  VALUES('delete', old.rowid, old.name, old.short_description, old.description, old.sku);
END;
CREATE TRIGGER IF NOT EXISTS products_fts_update AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, short_description, description, sku)
  VALUES('delete', old.rowid, old.name, old.short_description, old.description, old.sku);
  INSERT INTO products_fts(rowid, name, short_description, description, sku)
  VALUES (new.rowid, new.name, new.short_description, new.description, new.sku);
END;

-- =====================
-- PRODUCT IMAGES
-- =====================
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  medium_url TEXT,
  alt_text TEXT,
  is_primary INTEGER DEFAULT 0,
  is_ai_generated INTEGER DEFAULT 0,
  ai_style TEXT CHECK (ai_style IN ('modern_room', 'white_background', 'promotional', 'premium_catalog', NULL)),
  ai_prompt TEXT,
  original_image_id TEXT REFERENCES product_images(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  file_size_kb INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_store ON product_images(store_id);

-- =====================
-- BANNERS
-- =====================
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  button_text TEXT,
  position TEXT DEFAULT 'hero' CHECK (position IN ('hero', 'secondary', 'footer', 'popup')),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_banners_store ON banners(store_id);

-- =====================
-- AI GENERATIONS (controle de custos)
-- =====================
CREATE TABLE IF NOT EXISTS ai_generations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('description', 'image', 'full_ad')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_image_url TEXT,
  input_prompt TEXT,
  generated_name TEXT,
  generated_description TEXT,
  generated_category TEXT,
  generated_image_url TEXT,
  ai_model TEXT,
  ai_style TEXT,
  credits_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_store ON ai_generations(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_created ON ai_generations(created_at DESC);

-- =====================
-- ANALYTICS EVENTS
-- =====================
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('catalog_view', 'product_view', 'whatsapp_click', 'share_click', 'search', 'interest_list', 'banner_click')),
  session_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  metadata TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_store ON analytics_events(store_id);
CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- =====================
-- AUDIT LOGS
-- =====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_store ON audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- =====================
-- SESSIONS (opcional, para refresh tokens)
-- =====================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- =====================
-- INITIAL PLATFORM CONFIG
-- =====================
INSERT OR IGNORE INTO platform_config (id, platform_name, footer_text, support_email)
VALUES ('platform-default', 'Catálogos Pro', 'Sistema desenvolvido por Catálogos Pro', 'suporte@catalogospro.com');
