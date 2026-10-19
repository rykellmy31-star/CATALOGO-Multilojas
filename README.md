# 🛋️ Catálogos SaaS — Plataforma Profissional Multilojas com IA

Plataforma SaaS completa para criação e gestão de catálogos digitais profissionais. Cada loja possui catálogo público exclusivo, painel administrativo independente e integração com Inteligência Artificial para geração de anúncios comerciais de alta qualidade.

> **Status:** ✅ Pronto para produção | Cloudflare Workers + D1 + R2 | React + TypeScript + Tailwind

---

## 🌟 Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPER ADMINISTRADOR                      │
│  Dashboard global • Gestão de lojas • IA • Planos • Logs   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌────────┐     ┌────────┐     ┌────────┐
   │ LOJA A │     │ LOJA B │     │ LOJA C │
   │ Admin  │     │ Admin  │     │ Admin  │
   │ Painel │     │ Painel │     │ Painel │
   └───┬────┘     └───┬────┘     └───┬────┘
       │              │              │
       ▼              ▼              ▼
   /loja/a        /loja/b        /loja/c   ← Catálogos Públicos
```

### 3 Ambientes Independentes

| Ambiente | Rota | Descrição |
|----------|------|-----------|
| **Super Admin** | `/super-admin/*` | Controle total da plataforma |
| **Painel da Loja** | `/admin/*` | Gestão exclusiva da própria loja |
| **Catálogo Público** | `/loja/:slug` | Vitrine para clientes finais |

---

## 🚀 Tecnologias

| Camada | Stack |
|--------|-------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + React Router |
| **Backend** | Hono (Cloudflare Workers) + TypeScript |
| **Banco** | Cloudflare D1 (SQLite) + Drizzle ORM + Migrations |
| **Storage** | Cloudflare R2 (imagens otimizadas) |
| **Auth** | JWT + bcrypt + RBAC (Super Admin / Store Admin) |
| **IA** | OpenAI GPT-4o Vision + DALL·E 3 (com fallback configurável) |
| **Deploy** | Cloudflare Workers + Wrangler + GitHub Actions |
| **Testes** | Vitest + Testing Library |

---

## 📦 Estrutura de Pastas

```
catalogos-saas/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SuperAdmin/     # Dashboard, Lojas, IA Config
│   │   │   ├── StoreAdmin/     # Produtos, Categorias, Banners, Settings
│   │   │   ├── PublicCatalog/  # Vitrine, Produto Individual
│   │   │   └── Shared/         # Login, Setup, Erros
│   │   ├── components/
│   │   │   ├── ui/             # Button, Card, Input, Modal...
│   │   │   ├── layout/         # Header, Sidebar, Footer
│   │   │   └── catalog/        # ProductCard, Filters, Gallery
│   │   ├── contexts/           # AuthContext, ThemeContext
│   │   ├── lib/                # api.ts, utils, validation
│   │   └── hooks/
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/                # Cloudflare Worker (Hono)
│   └── src/
│       ├── index.ts        # App principal + rotas
│       ├── routes/         # auth, superadmin, store, public, ai
│       ├── services/       # ai, storage, analytics
│       ├── middleware/     # auth, tenant, rateLimit
│       ├── db/             # schema, migrations, seed
│       └── utils/          # hash, jwt, validation, slug
├── database/
│   ├── schema.sql          # Schema completo D1
│   ├── seed.sql            # Dados demonstrativos
│   └── migrations/         # Migrações versionadas
├── docs/                   # Documentação
├── tests/                  # Testes automatizados
├── wrangler.toml           # Config Cloudflare
├── .env.example            # Variáveis de ambiente
└── storage/                # Uploads locais (dev)
```

---

## ⚡ Início Rápido (5 minutos)

### 1. Clonar e instalar

```bash
git clone https://github.com/seu-usuario/catalogos-saas.git
cd catalogos-saas
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Configurar ambiente

```bash
cp .env.example .dev.vars
# Edite .dev.vars com suas chaves (ver seção abaixo)
```

### 3. Criar banco D1 local

```bash
npx wrangler d1 create catalogos_db
# Copie o database_id retornado para wrangler.toml e .dev.vars

# Executar schema + seed
npm run db:migrate
npm run db:seed
```

Ou manualmente:

```bash
npx wrangler d1 execute catalogos_db --file=./database/schema.sql --local
npx wrangler d1 execute catalogos_db --file=./database/seed.sql --local
```

### 4. Criar buckets R2

```bash
npx wrangler r2 bucket create catalogos-storage
npx wrangler r2 bucket create catalogos-public
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:8787
```

### 6. Criar primeiro Super Administrador

Acesse: `http://localhost:5173/setup`

Ou via API:

```bash
curl -X POST http://localhost:8787/api/auth/setup-super-admin \
  -H "Content-Type: application/json" \
  -d '{
    "setupToken": "SEU_SETUP_TOKEN_DO_.dev.vars",
    "name": "Administrador",
    "email": "admin@plataforma.com",
    "password": "SenhaForte123!"
  }'
```

---

## 🔐 Credenciais de Demonstração

Após rodar o seed:

| Papel | Email | Senha | Acesso |
|-------|-------|-------|--------|
| Super Admin | `super@catalogospro.com` | `Super123!` | `/super-admin` |
| Loja Móveis | `admin@moveispremium.com` | `Loja123!` | `/admin` |
| Loja Eletros | `admin@eletrocenter.com` | `Loja123!` | `/admin` |
| Loja Decor | `admin@decorart.com` | `Loja123!` | `/admin` |

Catálogos públicos:
- `/loja/moveis-premium`
- `/loja/eletro-center`
- `/loja/decor-art`

---

## 🤖 Configurar Inteligência Artificial

### OpenAI (recomendado)

1. Crie conta em https://platform.openai.com
2. Gere API Key em https://platform.openai.com/api-keys
3. Adicione em `.dev.vars`:

```env
AI_PROVIDER=openai
AI_ENABLED=true
OPENAI_API_KEY=sk-proj-xxxxxxxx
OPENAI_MODEL=gpt-4o
OPENAI_IMAGE_MODEL=dall-e-3
```

### Sem IA configurada

Se `OPENAI_API_KEY` não estiver definida, o sistema:
- ✅ Exibe aviso claro: *"IA indisponível - configure sua chave OpenAI"*
- ✅ Nunca simula geração falsa
- ✅ Mantém todo o resto funcionando normalmente
- ✅ Permite cadastro manual completo de produtos

### Custos estimados (OpenAI Jun/2024)

| Operação | Custo |
|----------|-------|
| Descrição + nome + categoria (GPT-4o Vision) | ~$0.01 |
| Imagem publicitária (DALL·E 3 1024x1024) | ~$0.04 |
| **Por produto completo** | **~$0.05** |

Configure limites por loja no painel Super Admin.

---

## 🚀 Deploy na Cloudflare

### Deploy manual

```bash
# Login
npx wrangler login

# Criar recursos em produção
npx wrangler d1 create catalogos_db --production
npx wrangler r2 bucket create catalogos-storage --production

# Configurar secrets (nunca no código!)
npx wrangler secret put JWT_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPER_ADMIN_SETUP_TOKEN

# Aplicar migrations em produção
npx wrangler d1 execute catalogos_db --file=./database/schema.sql --remote
npx wrangler d1 execute catalogos_db --file=./database/seed.sql --remote

# Deploy
npm run build
npx wrangler deploy
```

### Deploy via GitHub Actions

O arquivo `.github/workflows/deploy.yml` já está configurado:

1. No GitHub: `Settings > Secrets > Actions` adicione:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `OPENAI_API_KEY`
   - `JWT_SECRET`

2. Push na branch `main` → deploy automático

```bash
git add .
git commit -m "deploy: plataforma completa"
git push origin main
```

---

## 🗄️ Banco de Dados — Modelo Multi-Tenant

### Tabelas principais

- `users` — usuários (super_admin | store_admin) com isolamento por `store_id`
- `stores` — lojas com slug único, tema, WhatsApp, limites de IA
- `products` — produtos com SKU, preços, variações, status, destaque
- `product_images` — múltiplas imagens (original + IA gerada)
- `categories` — categorias por loja
- `brands` — marcas por loja
- `banners` — banners promocionais
- `ai_generations` — histórico e controle de custos de IA
- `analytics_events` — visitas e cliques (LGPD compliant)
- `audit_logs` — trilha de auditoria completa
- `platform_config` — identidade visual e limites globais

**Isolamento garantido:**
- Toda query filtra por `store_id` (middleware `tenant`)
- Validação de ownership em cada endpoint
- Testes automatizados de isolamento
- Não é possível acessar dados de outra loja mesmo alterando URL/IDs manualmente

Ver `database/schema.sql` para schema completo.

---

## 🔒 Segurança

- ✅ Senhas com bcrypt (12 rounds)
- ✅ JWT com expiração + refresh
- ✅ RBAC rigoroso (super_admin vs store_admin)
- ✅ Multi-tenant isolation em todas as queries
- ✅ Rate limiting (login, IA, uploads)
- ✅ Validação Zod em todos os endpoints
- ✅ CORS configurado
- ✅ Headers de segurança (CSP, HSTS, X-Frame-Options)
- ✅ Secrets apenas via `wrangler secret` (nunca no código)
- ✅ Logs de auditoria para toda ação administrativa
- ✅ Uploads validados (tipo, tamanho, malware scan ready)
- ✅ SQL injection protegido (prepared statements)

---

## 📱 Funcionalidades Implementadas

### Super Admin
- [x] Login exclusivo + JWT
- [x] Dashboard global (lojas, produtos, visitas, IA)
- [x] CRUD de lojas + ativação/suspensão
- [x] Gestão de admins por loja
- [x] Limites de armazenamento e IA por loja
- [x] Configuração visual da plataforma
- [x] Histórico de auditoria
- [x] Visualização suporte (com log)

### Painel da Loja
- [x] Dashboard com métricas
- [x] CRUD produtos (SKU, preços, variações, status)
- [x] Upload múltiplo de imagens com otimização
- [x] Categorias e marcas
- [x] Produtos em destaque e banners
- [x] Personalização visual (cores, logo)
- [x] Config WhatsApp
- [x] IA: descrição + imagem publicitária
- [x] Pré-visualização do catálogo
- [x] Import/Export CSV
- [x] Duplicação rápida
- [x] Estatísticas de visitas/cliques

### Catálogo Público
- [x] Página da loja com identidade própria
- [x] Busca + filtros + ordenação
- [x] Página individual do produto com galeria
- [x] Produtos relacionados
- [x] Botão WhatsApp com mensagem automática
- [x] Lista de interesse multi-produtos
- [x] Compartilhamento
- [x] SEO otimizado (meta, OG, JSON-LD)
- [x] Responsivo mobile-first
- [x] Performance (lazy load, paginação)

---

## 🧪 Testes

```bash
npm test                 # todos os testes
npm test -- --coverage   # com cobertura
npm run test:isolation   # testes críticos de isolamento multi-tenant
```

---

## 📚 Documentação Adicional

- `docs/INSTALACAO.md` — Guia passo a passo
- `docs/CLOUDFLARE.md` — Configuração detalhada
- `docs/IA.md` — Integração IA + custos + estilos
- `docs/API.md` — Referência da API
- `docs/SEGURANCA.md` — Modelo de segurança

---

## 📄 Licença

Proprietário — Todos os direitos reservados.  
Desenvolvido como plataforma SaaS comercial.

---

## 💬 Suporte

- Email: suporte@seudominio.com
- Issues: GitHub Issues
- Docs: `/docs`

---

**Sistema desenvolvido por Catálogos Pro** — Nome configurável pelo Super Admin em `Configurações > Identidade Visual`.
