# Guia de Instalação — Passo a Passo

## 1. Pré-requisitos

- Node.js 18+ e npm
- Conta Cloudflare (para deploy)
- Git
- Conta OpenAI (para IA, opcional)

## 2. Instalação Local (5 minutos)

```bash
git clone https://github.com/seu-usuario/catalogos-saas.git
cd catalogos-saas
npm install
npm install --prefix frontend
npm install --prefix backend
cp .env.example .dev.vars
# Edite .dev.vars com suas chaves
```

### Criar banco local

```bash
npx wrangler d1 create catalogos_db
# Copie database_id para wrangler.toml

npx wrangler d1 execute catalogos_db --file=./database/schema.sql --local
npx wrangler d1 execute catalogos_db --file=./database/seed.sql --local

npx wrangler r2 bucket create catalogos-storage
```

### Rodar

```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:8787
```

Acesse http://localhost:5173/setup para criar o primeiro Super Admin.

## 3. Configurar Super Admin

- Token padrão dev: `setup-dev-token-change-me`
- Defina `SUPER_ADMIN_SETUP_TOKEN` e `JWT_SECRET` em `.dev.vars` com valores fortes para produção.

## 4. Próximos Passos

- Veja `CLOUDFLARE.md` para deploy
- Veja `IA.md` para configurar OpenAI
- Veja `API.md` para referência da API
