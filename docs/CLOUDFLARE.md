# Deploy na Cloudflare

## 1. Login

```bash
npx wrangler login
```

## 2. Criar recursos em produção

```bash
npx wrangler d1 create catalogos_db --remote
# Copie database_id para wrangler.toml -> database_id

npx wrangler r2 bucket create catalogos-storage
npx wrangler r2 bucket create catalogos-public

# Configurar domínio público R2 (opcional, para servir imagens)
# Cloudflare Dashboard > R2 > Seu bucket > Settings > Public access
```

## 3. Secrets (nunca no código!)

```bash
npx wrangler secret put JWT_SECRET
# Cole um valor forte com 64+ caracteres

npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPER_ADMIN_SETUP_TOKEN
```

## 4. Migrations em produção

```bash
npx wrangler d1 execute catalogos_db --file=./database/schema.sql --remote
npx wrangler d1 execute catalogos_db --file=./database/seed.sql --remote
```

## 5. Build & Deploy

```bash
npm run build --prefix frontend
npx wrangler deploy
```

Ou push para `main` com GitHub Actions (configure secrets no GitHub).

## 6. Domínio customizado

Cloudflare Dashboard > Workers & Pages > Seu worker > Settings > Triggers > Add Custom Domain

Ex: `seudominio.com` e `api.seudominio.com`.

## 7. Variáveis de ambiente

Defina em `wrangler.toml` [vars] e via `wrangler secret`.

## 8. Cron

Configurado em `wrangler.toml` [triggers] para limpeza diária.

## Troubleshooting

- `D1_ERROR`: verifique database_id
- `R2 403`: verifique permissões do bucket
- `CORS`: ajuste em backend/src/index.ts cors origin
