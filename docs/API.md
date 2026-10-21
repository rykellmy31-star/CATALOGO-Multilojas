# API Reference

Base URL: `https://seudominio.com/api` (ou `http://localhost:8787/api` dev)

## Autenticação

`POST /api/auth/login` — body: {email, password} → {token, user}
`POST /api/auth/setup-super-admin` — body: {setupToken, name, email, password}
`GET /api/auth/check-setup` — {needsSetup: boolean}
`GET /api/auth/me` — header Authorization: Bearer <token>

## Super Admin (requer role super_admin)

`GET /api/superadmin/dashboard`
`GET /api/superadmin/stores?q&status`
`POST /api/superadmin/stores`
`GET /api/superadmin/stores/:id`
`PUT /api/superadmin/stores/:id`
`DELETE /api/superadmin/stores/:id`
`POST /api/superadmin/stores/:id/admins`
`PUT /api/superadmin/stores/:id/admins/:adminId/reset-password`
`GET /api/superadmin/platform-config`
`PUT /api/superadmin/platform-config`
`GET /api/superadmin/audit-logs?page&limit`
`GET /api/superadmin/stores/:id/support-view`

## Store Admin (requer store_admin)

`GET /api/store/dashboard`
`GET /api/store/products?q&category&status&featured&page&limit`
`POST /api/store/products`
`PUT /api/store/products/:id`
`DELETE /api/store/products/:id`
`POST /api/store/products/:id/duplicate`
`GET /api/store/categories`
`POST /api/store/categories`
`etc.` — ver backend/src/routes/store.ts para lista completa

`POST /api/store/ai/generate` — {image_url, style, product_id}
`GET /api/store/ai/history`
`POST /api/upload` — multipart/form-data file

## Público (sem auth)

`GET /api/public/stores/:slug`
`GET /api/public/stores/:slug/products?q&category&brand&minPrice&maxPrice&sort&page&limit`
`GET /api/public/stores/:slug/products/:productSlug`
`POST /api/public/stores/:slug/analytics` — {event_type, product_id}
`GET /api/public/search?q`

Todas as respostas são JSON. Erros retornam {error, details}.
