# Configuração Cloudflare

## Recursos necessários

- 1 Worker (catalogos-saas)
- 1 D1 Database (catalogos_db)
- 2 R2 Buckets (catalogos-storage, catalogos-public)
- Domínio customizado (opcional)

## Secrets

```
JWT_SECRET
OPENAI_API_KEY
SUPER_ADMIN_SETUP_TOKEN
```

Definir via `wrangler secret put <NOME>`

## Vars (wrangler.toml)

```
PLATFORM_NAME
AI_PROVIDER
AI_ENABLED
ENVIRONMENT
R2_PUBLIC_URL
```

## Cron

Limpeza diária de analytics antigos (configurado em wrangler.toml).
