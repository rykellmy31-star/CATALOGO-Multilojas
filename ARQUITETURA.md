# Arquitetura

## Fluxo Multi-tenant

```
Cliente (navegador)
   │
   ├── /loja/:slug → Public API (sem auth, apenas slug público)
   │          │
   │          └── D1: SELECT * FROM stores WHERE slug = ? AND status='active'
   │                  SELECT * FROM products WHERE store_id = ? AND status='published'
   │
   ├── /admin/* → Store Admin (JWT + store_id no token)
   │          │
   │          └── Middleware: tenantFilter(store_id = token.storeId)
   │                  Todas queries: WHERE store_id = ?
   │
   └── /super-admin/* → Super Admin (JWT role=super_admin)
              │
              └── Pode acessar qualquer store, mas com audit_logs
                      WHERE store_id = ? (quando específico)
```

## Segurança

- Senhas: bcrypt 12 rounds
- JWT: 7d expiração, httpOnly opcional
- RBAC: super_admin vs store_admin
- Rate limit: login 5/min, IA 10/dia
- CORS: origin whitelist
- Validação: Zod em todas entradas
- Headers: CSP, HSTS, X-Frame-Options

## IA

```
Upload foto → POST /api/store/ai/generate {image_url, style}
   │
   ├── Verifica limite diário (ai_daily_limit)
   ├── Verifica OPENAI_API_KEY (se ausente → 503)
   ├── Gera descrição via GPT-4o Vision
   ├── Gera imagem via DALL·E 3 (estilo escolhido)
   ├── Registra em ai_generations (custo, modelo)
   └── Retorna {name, description, category, imageUrl, cost}
           │
           └── Frontend: exibe prévia → usuário clica "Aplicar" → salva no produto
                           → Imagem marcada como is_ai_generated = 1 (ilustrativa)
```

## Storage

```
Upload: POST /api/upload (multipart)
   │
   ├── Valida tipo (jpeg/png/webp) e tamanho (10MB)
   ├── Gera key: stores/{storeId}/products/{productId}/{timestamp}.jpg
   ├── Put no R2 bucket (com cache-control 1 ano)
   └── Retorna URL pública (R2_PUBLIC_URL ou /api/storage/:key)

Public serving: GET /api/storage/:key → R2.get(key) → Response com Content-Type
```

## Banco

Todas tabelas têm store_id exceto platform_config e users super_admin.
Índices em store_id + slug para performance.
FTS5 para busca de produtos.
Soft delete para stores (status='deleted').

