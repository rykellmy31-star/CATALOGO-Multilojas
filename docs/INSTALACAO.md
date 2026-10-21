# Instalação local — Catálogo Multiloja

## Pré-requisitos

- Node.js >= 22.13, npm e Git.
- GitHub Actions usa Node.js 22. O teste de navegador também exige Chromium (instalado pelo Playwright).
- Para desenvolvimento **local**, não é preciso provisionar D1/R2 remotos nem contratar serviços de IA.

## Obter o projeto e preparar secrets locais

```bash
git clone https://github.com/rykellmy31-star/CATALOGO-Multilojas.git
cd CATALOGO-Multilojas
git switch desenvolvimento/seguranca-e-implantacao
npm ci
cp .dev.vars.example .dev.vars
```

Edite somente a cópia **não versionada** `.dev.vars` e preencha `JWT_SECRET` e `SUPER_ADMIN_SETUP_TOKEN` com valores fortes, aleatórios e **distintos**, com no mínimo 32 caracteres. Para gerar um valor local com Node.js, execute, separadamente para cada segredo:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Não há token padrão de desenvolvimento válido. Nunca publique `.dev.vars` e não reutilize secrets locais em produção. Mantenha `AI_ENABLED=false` para evitar chamadas externas pagas.

## Inicializar banco e executar aplicação

```bash
npm run db:migrate
npm run dev
```

- Frontend Vite: http://localhost:5173
- Worker API local: http://localhost:8787
- O proxy do Vite encaminha `/api` para o Worker; não é necessário definir `VITE_API_URL` em desenvolvimento normal.
- Abra http://localhost:5173/setup para configurar o primeiro superadministrador usando seu token de bootstrap local.

O D1 e os buckets R2 são bindings locais do Wrangler. **Não** execute `wrangler d1 create`, `database/schema.sql`, `database/seed.sql` ou comandos `--remote` para iniciar o ambiente local.

## Validar antes de abrir PR

```bash
python3 scripts/auditar-seguranca.py
python3 scripts/test-auditar-seguranca.py
npm audit --audit-level=moderate
npm test
npm run build
npx wrangler deploy --dry-run --env='' --outdir /tmp/catalogo-worker
```

O workflow `.github/workflows/validar-projeto.yml` repete essas validações e pode testar Chromium e R2 locais com o marcador `[browser ci]`. Para o navegador local, instale o Chromium do Playwright e execute `npm run test:browser` após as migrações.

## Publicação

Não confunda esta instalação com homologação comercial. Para configurar domínios, Secrets, backups e migrações remotas **somente após aprovação**, consulte `docs/CLOUDFLARE.md` e `docs/HOMOLOGACAO-COMERCIAL.md`.
