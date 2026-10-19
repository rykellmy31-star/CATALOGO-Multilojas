-- ============================================
-- SEED - DADOS DEMONSTRATIVOS
-- 3 Lojas + Produtos + Categorias + Banners
-- Senhas: hash bcrypt de "Super123!" e "Loja123!" (gerado)
-- Para dev local, senhas em texto serão validadas via API (hash on-the-fly)
-- ============================================

-- Nota: No ambiente real, o backend faz hash com bcrypt.
-- Aqui usamos hashes pré-gerados para demonstração.
-- Hash bcrypt 12 rounds para "Super123!" e "Loja123!"

DELETE FROM analytics_events;
DELETE FROM ai_generations;
DELETE FROM product_images;
DELETE FROM products;
DELETE FROM banners;
DELETE FROM categories;
DELETE FROM brands;
DELETE FROM users;
DELETE FROM stores;

-- ============ STORES ============
INSERT INTO stores (id, name, slug, description, primary_color, secondary_color, accent_color, address, city, state, whatsapp, email, instagram, status, plan) VALUES
('store-001', 'Móveis Premium', 'moveis-premium', 'Móveis de alto padrão para sua casa. Sofás, mesas, cadeiras e decoração com qualidade e design exclusivo. Entregamos em todo Brasil.', '#0ea5e9', '#0f172a', '#f59e0b', 'Av. Brasil, 1500 - Centro', 'Teixeira de Freitas', 'BA', '5573999990001', 'contato@moveispremium.com', '@moveispremium', 'active', 'pro'),
('store-002', 'Eletro Center', 'eletro-center', 'Os melhores eletrodomésticos e eletrônicos com garantia e preço justo. Geladeiras, TVs, smartphones e muito mais.', '#dc2626', '#1f2937', '#facc15', 'Rua das Flores, 320 - Centro', 'Itanhém', 'BA', '5573999990002', 'contato@eletrocenter.com', '@eletrocenter', 'active', 'pro'),
('store-003', 'Decor Art', 'decor-art', 'Decoração e utilidades domésticas para transformar seu lar. Vasos, quadros, luminárias e acessórios exclusivos.', '#7c3aed', '#1e1b4b', '#ec4899', 'Rua Minas Gerais, 88 - Centro', 'Medeiros Neto', 'BA', '5573999990003', 'contato@decorart.com', '@decorart', 'active', 'free');

-- ============ USERS ============
-- Senhas hasheadas: Super123! / Loja123! 
-- Em produção são geradas via bcrypt. Aqui usamos placeholders que o backend reconhece.
-- O worker em modo dev aceita verificação plain + hash.

INSERT INTO users (id, name, email, password_hash, role, store_id, is_active) VALUES
('user-super-001', 'Super Administrador', 'super@catalogospro.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCfuBRyJy', 'super_admin', NULL, 1),
('user-store-001', 'Admin Móveis Premium', 'admin@moveispremium.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCfuBRyJy', 'store_admin', 'store-001', 1),
('user-store-002', 'Admin Eletro Center', 'admin@eletrocenter.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCfuBRyJy', 'store_admin', 'store-002', 1),
('user-store-003', 'Admin Decor Art', 'admin@decorart.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCfuBRyJy', 'store_admin', 'store-003', 1);

-- ============ CATEGORIES ============
INSERT INTO categories (id, store_id, name, slug, description, sort_order) VALUES
-- Móveis Premium
('cat-001', 'store-001', 'Sofás', 'sofas', 'Sofás retráteis, fixos e de canto', 1),
('cat-002', 'store-001', 'Mesas', 'mesas', 'Mesas de jantar, centro e lateral', 2),
('cat-003', 'store-001', 'Cadeiras', 'cadeiras', 'Cadeiras estofadas e de madeira', 3),
('cat-004', 'store-001', 'Camas', 'camas', 'Camas box, casal e solteiro', 4),
('cat-005', 'store-001', 'Estantes', 'estantes', 'Estantes e racks', 5),
-- Eletro Center
('cat-006', 'store-002', 'Geladeiras', 'geladeiras', 'Geladeiras duplex e frost free', 1),
('cat-007', 'store-002', 'Televisores', 'televisores', 'Smart TVs 4K e 8K', 2),
('cat-008', 'store-002', 'Smartphones', 'smartphones', 'Celulares e acessórios', 3),
('cat-009', 'store-002', 'Eletroportáteis', 'eletroportateis', 'Liquidificadores, batedeiras', 4),
-- Decor Art
('cat-010', 'store-003', 'Vasos', 'vasos', 'Vasos decorativos', 1),
('cat-011', 'store-003', 'Quadros', 'quadros', 'Quadros e telas', 2),
('cat-012', 'store-003', 'Luminárias', 'luminarias', 'Luminárias modernas', 3),
('cat-013', 'store-003', 'Utilidades', 'utilidades', 'Utilidades domésticas', 4);

-- ============ BRANDS ============
INSERT INTO brands (id, store_id, name, slug) VALUES
('brand-001', 'store-001', 'Artesano', 'artesano'),
('brand-002', 'store-001', 'Casa Bella', 'casa-bella'),
('brand-003', 'store-002', 'Brastemp', 'brastemp'),
('brand-004', 'store-002', 'Samsung', 'samsung'),
('brand-005', 'store-002', 'LG', 'lg'),
('brand-006', 'store-003', 'Decoralle', 'decoralle');

-- ============ BANNERS ============
INSERT INTO banners (id, store_id, title, subtitle, image_url, button_text, link_url, position, is_active, sort_order) VALUES
('banner-001', 'store-001', 'Sofás com até 40% OFF', 'Aproveite nossa liquidação de sofás retráteis', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200', 'Ver Ofertas', '/loja/moveis-premium?filter=promo', 'hero', 1, 1),
('banner-002', 'store-002', 'Tecnologia que transforma', 'Smart TVs a partir de 12x sem juros', 'https://images.unsplash.com/photo-1593359677879-a4bb92f367d8?w=1200', 'Conferir', '/loja/eletro-center', 'hero', 1, 1),
('banner-003', 'store-003', 'Sua casa mais bonita', 'Decoração com até 30% de desconto', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200', 'Decorar Agora', '/loja/decor-art', 'hero', 1, 1);

-- ============ PRODUCTS - MÓVEIS PREMIUM ============
INSERT INTO products (id, store_id, sku, name, slug, short_description, description, price, original_price, promotional_price, category_id, brand_id, status, is_featured, is_on_sale, stock_quantity, dimensions, views, clicks) VALUES
('prod-001', 'store-001', 'SOF-RETR-001', 'Sofá Retrátil 2,30m Premium', 'sofa-retratil-230-premium', 'Sofá retrátil com molas ensacadas e tecido suede', 'Sofá retrátil 2,30m com estrutura em madeira maciça, molas ensacadas individualmente, espuma D33 e tecido suede premium. Ideal para salas amplas. Reclinável com 3 posições. Entrega e montagem inclusas na região.', 2899.00, 3899.00, 2899.00, 'cat-001', 'brand-001', 'published', 1, 1, 15, '{"width":230,"height":95,"depth":100,"unit":"cm"}', 342, 89),
('prod-002', 'store-001', 'MESA-JANT-002', 'Mesa de Jantar 6 Lugares Rústica', 'mesa-jantar-6-lugares-rustica', 'Mesa em madeira maciça com 6 cadeiras estofadas', 'Mesa de jantar retangular 180x90cm em madeira maciça de jequitibá, acabamento rústico envernizado. Acompanha 6 cadeiras com assento estofado em linho. Suporta até 120kg por assento.', 1899.00, 2499.00, 1899.00, 'cat-002', 'brand-002', 'published', 1, 1, 8, '{"width":180,"height":77,"depth":90,"unit":"cm"}', 256, 45),
('prod-003', 'store-001', 'CADEIRA-003', 'Cadeira Eames Estofada', 'cadeira-eames-estofada', 'Cadeira design Eames com base em madeira', 'Cadeira estilo Eames com concha em ABS e almofada estofada, base em madeira de faia. Disponível em 5 cores. Empilhável. Ideal para sala de jantar ou escritório.', 299.00, 399.00, NULL, 'cat-003', 'brand-001', 'published', 0, 0, 40, '{"width":45,"height":82,"depth":52,"unit":"cm"}', 189, 32),
('prod-004', 'store-001', 'CAMA-BOX-004', 'Cama Box Casal Queen Size', 'cama-box-casal-queen', 'Cama box com baú e cabeceira estofada', 'Cama box Queen 158x198cm com baú de grande capacidade (650L), cabeceira estofada em veludo e pés em madeira. Estrutura reforçada suporta até 300kg.', 1299.00, 1799.00, 1299.00, 'cat-004', 'brand-002', 'published', 1, 1, 5, '{"width":158,"height":120,"depth":198,"unit":"cm"}', 412, 102),
('prod-005', 'store-001', 'RACK-005', 'Rack para TV 180cm Moderno', 'rack-tv-180-moderno', 'Rack com painel para TV até 65 polegadas', 'Rack + painel para TV até 65" em MDF com acabamento em laca fosca. Portas com amortecimento, nichos para decoração e passa-fio. Cor: Freijó com Off White.', 899.00, 1199.00, NULL, 'cat-005', 'brand-001', 'published', 0, 0, 12, '{"width":180,"height":45,"depth":40,"unit":"cm"}', 178, 28),
('prod-006', 'store-001', 'SOFA-CANTO-006', 'Sofá de Canto 5 Lugares', 'sofa-canto-5-lugares', 'Sofá de canto com chaise e tecido premium', 'Sofá de canto 280x180cm para 5 pessoas, com chaise reversível e assentos retráteis. Tecido linho, espuma D28, pés em aço inox. Disponível em bege, cinza e azul.', 3499.00, 4499.00, 3499.00, 'cat-001', 'brand-001', 'published', 1, 1, 3, '{"width":280,"height":85,"depth":180,"unit":"cm"}', 298, 67);

-- ============ PRODUCTS - ELETRO CENTER ============
INSERT INTO products (id, store_id, sku, name, slug, short_description, description, price, original_price, promotional_price, category_id, brand_id, status, is_featured, is_on_sale, stock_quantity, views, clicks) VALUES
('prod-007', 'store-002', 'GEL-BRAST-007', 'Geladeira Brastemp 400L Frost Free', 'geladeira-brastemp-400l-frost-free', 'Geladeira duplex inverse com painel eletrônico', 'Geladeira Brastemp BRM44 400L Frost Free, cor Inox, painel eletrônico externo, filtro de água, turbo ice e compartimento extra frio. Classe A em consumo.', 3299.00, 4299.00, 3299.00, 'cat-006', 'brand-003', 'published', 1, 1, 7, 523, 134),
('prod-008', 'store-002', 'TV-SAMS-008', 'Smart TV Samsung 55" 4K UHD', 'smart-tv-samsung-55-4k', 'TV Crystal UHD com Tizen e controle remoto único', 'Smart TV Samsung 55" Crystal UHD 4K, processador Crystal 4K, HDR, Wi-Fi integrado, Bluetooth, 3 HDMI, 2 USB. Sistema Tizen com Netflix, Prime Video e mais.', 2499.00, 3299.00, 2499.00, 'cat-007', 'brand-004', 'published', 1, 1, 10, 612, 201),
('prod-009', 'store-002', 'CEL-SAMS-009', 'Smartphone Samsung Galaxy A54 256GB', 'smartphone-samsung-galaxy-a54', 'Galaxy A54 com câmera tripla e 5G', 'Samsung Galaxy A54 5G 256GB, tela Super AMOLED 6.4" 120Hz, câmera tripla 50MP, bateria 5000mAh, IP67, 8GB RAM. Carregador incluso.', 1899.00, 2399.00, 1899.00, 'cat-008', 'brand-004', 'published', 1, 1, 20, 445, 98),
('prod-010', 'store-002', 'MICRO-LG-010', 'Micro-ondas LG 30L Grill', 'microondas-lg-30l-grill', 'Micro-ondas com grill e função descongelar', 'Micro-ondas LG MH3097 30L com grill, painel digital, 10 níveis de potência, função descongelar por peso e travar painel. Inox.', 649.00, 799.00, NULL, 'cat-009', 'brand-005', 'published', 0, 0, 15, 167, 22),
('prod-011', 'store-002', 'TV-LG-011', 'Smart TV LG 50" 4K NanoCell', 'smart-tv-lg-50-nanocell', 'TV NanoCell com ThinQ AI e Dolby Atmos', 'Smart TV LG 50" NanoCell 4K, processador α5 Gen5, ThinQ AI, Dolby Vision e Atmos, webOS, controle Smart Magic. Ideal para games com baixa latência.', 2299.00, 2999.00, 2299.00, 'cat-007', 'brand-005', 'published', 0, 1, 6, 334, 56);

-- ============ PRODUCTS - DECOR ART ============
INSERT INTO products (id, store_id, sku, name, slug, short_description, description, price, original_price, promotional_price, category_id, brand_id, status, is_featured, is_on_sale, stock_quantity, views, clicks) VALUES
('prod-012', 'store-003', 'VASO-CER-012', 'Vaso Cerâmica Grande 60cm', 'vaso-ceramica-grande-60cm', 'Vaso de cerâmica artesanal bege fosco', 'Vaso grande 60cm altura em cerâmica esmaltada, acabamento bege fosco com textura. Ideal para plantas grandes como costela-de-adão. Feito à mão.', 189.00, 249.00, NULL, 'cat-010', 'brand-006', 'published', 1, 0, 25, 134, 18),
('prod-013', 'store-003', 'QUADRO-013', 'Quadro Decorativo Abstrato 90x60', 'quadro-decorativo-abstrato-90x60', 'Quadro canvas com arte abstrata moderna', 'Quadro decorativo 90x60cm impresso em canvas com moldura flutuante preta. Arte abstrata em tons terrosos e azul. Pronto para pendurar.', 129.00, 189.00, 129.00, 'cat-011', 'brand-006', 'published', 1, 1, 30, 98, 12),
('prod-014', 'store-003', 'LUMIN-014', 'Luminária Pendente Moderna Dourada', 'luminaria-pendente-dourada', 'Pendente com cúpula em vidro e base dourada', 'Luminária pendente moderna com cúpula em vidro âmbar e haste dourada. Soquete E27, altura ajustável até 150cm. Ideal para sala de jantar.', 249.00, 349.00, NULL, 'cat-012', 'brand-006', 'published', 0, 0, 18, 76, 9),
('prod-015', 'store-003', 'KIT-UTIL-015', 'Kit Organizador de Cozinha 5 Peças', 'kit-organizador-cozinha-5pecas', 'Kit com potes herméticos e suporte de bambu', 'Kit organizador 5 peças: 3 potes herméticos de vidro com tampa de bambu, 1 suporte e 1 colher. Mantém mantimentos frescos por mais tempo.', 89.00, 129.00, 89.00, 'cat-013', 'brand-006', 'published', 1, 1, 50, 112, 15),
('prod-016', 'store-003', 'ALMOFADA-016', 'Kit 4 Almofadas Decorativas', 'kit-4-almofadas-decorativas', 'Kit com 4 capas de almofada em linho', 'Kit 4 capas de almofada 45x45cm em linho premium, estampas geométricas em tons neutros. Zíper invisível. Enchimento não incluso.', 119.00, 159.00, NULL, 'cat-011', 'brand-006', 'published', 0, 0, 40, 67, 8);

-- ============ PRODUCT IMAGES ============
INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order) VALUES
('img-001', 'prod-001', 'store-001', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800', 1, 1),
('img-002', 'prod-001', 'store-001', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 0, 2),
('img-003', 'prod-002', 'store-001', 'https://images.unsplash.com/photo-1615063867186-68ddf6a6d2b0?w=800', 1, 1),
('img-004', 'prod-003', 'store-001', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 1, 1),
('img-005', 'prod-004', 'store-001', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800', 1, 1),
('img-006', 'prod-005', 'store-001', 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=800', 1, 1),
('img-007', 'prod-006', 'store-001', 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800', 1, 1),
('img-008', 'prod-007', 'store-002', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800', 1, 1),
('img-009', 'prod-008', 'store-002', 'https://images.unsplash.com/photo-1593359677879-a4bb92f367d8?w=800', 1, 1),
('img-010', 'prod-009', 'store-002', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800', 1, 1),
('img-011', 'prod-010', 'store-002', 'https://images.unsplash.com/photo-1584266337361-9a33982d7dc1?w=800', 1, 1),
('img-012', 'prod-011', 'store-002', 'https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=800', 1, 1),
('img-013', 'prod-012', 'store-003', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800', 1, 1),
('img-014', 'prod-013', 'store-003', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800', 1, 1),
('img-015', 'prod-014', 'store-003', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800', 1, 1),
('img-016', 'prod-015', 'store-003', 'https://images.unsplash.com/photo-1584266337361-9a33982d7dc1?w=800', 1, 1),
('img-017', 'prod-016', 'store-003', 'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=800', 1, 1);

-- ============ ANALYTICS MOCK ============
INSERT INTO analytics_events (id, store_id, product_id, event_type, session_id) VALUES
('evt-001', 'store-001', 'prod-001', 'catalog_view', 'sess-001'),
('evt-002', 'store-001', 'prod-001', 'product_view', 'sess-001'),
('evt-003', 'store-001', 'prod-001', 'whatsapp_click', 'sess-001'),
('evt-004', 'store-002', 'prod-008', 'catalog_view', 'sess-002'),
('evt-005', 'store-002', 'prod-008', 'whatsapp_click', 'sess-002'),
('evt-006', 'store-003', NULL, 'catalog_view', 'sess-003');

-- ============ AUDIT LOG ============
INSERT INTO audit_logs (id, user_id, store_id, action, entity_type, entity_id, details) VALUES
('audit-001', 'user-super-001', NULL, 'create_store', 'store', 'store-001', '{"name":"Móveis Premium"}'),
('audit-002', 'user-super-001', NULL, 'create_store', 'store', 'store-002', '{"name":"Eletro Center"}'),
('audit-003', 'user-super-001', NULL, 'create_store', 'store', 'store-003', '{"name":"Decor Art"}');
