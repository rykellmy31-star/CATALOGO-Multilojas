-- Reject cross-store relations even when writes bypass the API.
CREATE TRIGGER IF NOT EXISTS tenant_products_category_id_insert BEFORE INSERT ON products
WHEN NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id = NEW.category_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_products_category_id_update BEFORE UPDATE ON products
WHEN NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id = NEW.category_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_products_brand_id_insert BEFORE INSERT ON products
WHEN NEW.brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brands WHERE id = NEW.brand_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_products_brand_id_update BEFORE UPDATE ON products
WHEN NEW.brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brands WHERE id = NEW.brand_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_categories_parent_id_insert BEFORE INSERT ON categories
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id = NEW.parent_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_categories_parent_id_update BEFORE UPDATE ON categories
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id = NEW.parent_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_product_images_product_id_insert BEFORE INSERT ON product_images
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_product_images_product_id_update BEFORE UPDATE ON product_images
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_ai_generations_product_id_insert BEFORE INSERT ON ai_generations
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_ai_generations_product_id_update BEFORE UPDATE ON ai_generations
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_ai_generations_user_id_insert BEFORE INSERT ON ai_generations
WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_ai_generations_user_id_update BEFORE UPDATE ON ai_generations
WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_analytics_events_product_id_insert BEFORE INSERT ON analytics_events
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_analytics_events_product_id_update BEFORE UPDATE ON analytics_events
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND store_id = NEW.store_id)
BEGIN SELECT RAISE(ABORT, 'tenant relation mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tenant_products_immutable BEFORE UPDATE OF store_id ON products
WHEN NEW.store_id IS NOT OLD.store_id
BEGIN SELECT RAISE(ABORT, 'tenant is immutable'); END;
CREATE TRIGGER IF NOT EXISTS tenant_categories_immutable BEFORE UPDATE OF store_id ON categories
WHEN NEW.store_id IS NOT OLD.store_id
BEGIN SELECT RAISE(ABORT, 'tenant is immutable'); END;
CREATE TRIGGER IF NOT EXISTS tenant_brands_immutable BEFORE UPDATE OF store_id ON brands
WHEN NEW.store_id IS NOT OLD.store_id
BEGIN SELECT RAISE(ABORT, 'tenant is immutable'); END;
CREATE TRIGGER IF NOT EXISTS tenant_users_immutable BEFORE UPDATE OF store_id ON users
WHEN NEW.store_id IS NOT OLD.store_id
BEGIN SELECT RAISE(ABORT, 'tenant is immutable'); END;
