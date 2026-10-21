# Implantação controlada na Cloudflare — Catálogo Multiloja

> Este guia **não autoriza** deploy, migração remota nem publicação da branch `main`. Antes de atuar na Cloudflare, obter aprovação específica, conferir custos, backups e o ambiente de destino.

## Pré-requisitos e verificações

- Node.js >= 22.13, `npm ci`, `npm test`, `npm run build`.
- GitHub Actions verde no SHA candidato, incluindo navegador/R2 local conforme `docs/HOMOLOGACAO-COMERCIAL.md`.
- Conta Cloudflare autorizada, domínio, capacidade dos planos e responsável pela operação.
- Backups verificados, procedimento de rollback e janela de manutenção para migrações remotas.

## Bindings do Worker

O arquivo `wrangler.toml` contém **identificadores locais/exemplificativos**. Nunca use `local-catalogos-db` como ID remoto.

Após autorização, provisionar ou identificar:
- D1 `catalogos_db`: substituir `database_id` pelo ID real **do ambiente escolhido**.
- R2 `STORAGE` (bucket `catalogos-storage`): privado, sem acesso público direto.
- R2 `STORAGE_PUBLIC` (bucket `catalogos-public`): imagens publicadas são servidas pelas rotas controladas do Worker; não habilitar acesso público irrestrito sem revisão.
- Worker Assets: `./frontend/dist`, disponibilizado pelo próprio Worker; o Vite usa proxy `/api` apenas em desenvolvimento.

Para criar novos recursos, somente se aprovados previamente, consulte `wrangler d1 create` e `wrangler r2 bucket create`. Criação de recursos pode envolver cobrança e não integra o CI.

## Secrets e configuração

Definir, no ambiente autorizado, `JWT_SECRET` aleatório forte (mínimo técnico de 32 caracteres; preferir 64 ou mais) e `SUPER_ADMIN_SETUP_TOKEN` independente. Usar Secrets do Worker via dashboard ou `npx wrangler secret put NOME` com o ambiente correto. Nunca inserir valores em arquivos versionados ou logs.

- `CORS_ALLOWED_ORIGINS`: lista de origens exatas separadas por vírgula **somente** quando houver frontend em outra origem; para Worker e frontend na mesma origem, não é necessário.
- `AI_ENABLED=false` permanece até homologação e aprovação explícita de custos/quotas; `OPENAI_API_KEY` é opcional enquanto desativada.
- Conferir se cada ambiente de `wrangler.toml` possui explicitamente os bindings D1/R2 e Secrets necessários. Não pressupor herança de bindings por `[env.staging]`.

## Migrações, publicação e reversão

**Teste local** (seguro, sem modificar D1 remoto):

```bash
npm ci
npm test
npm run build
npm run db:migrate
npx wrangler deploy --dry-run --env='' --outdir /tmp/catalogo-worker
```

**Somente após autorização e backup do banco remoto**, aplicar as migrações versionadas de `database/migrations` ao ambiente selecionado por meio de `wrangler d1 migrations apply catalogos_db --remote` com a configuração adequada, conferir resultado e testar as rotas críticas. **Não** aplicar `database/schema.sql` diretamente a um banco existente, nem executar `database/seed.sql` na produção: isso contorna o controle de migrações e pode inserir dados de demonstração.

Após a homologação manual e aprovação separada, `npx wrangler deploy` publica o Worker no ambiente configurado. O workflow `.github/workflows/validar-projeto.yml` **apenas valida** a branch `desenvolvimento/seguranca-e-implantacao`; push na `main` não publica este projeto automaticamente.

Em caso de falha, interromper a liberação, reverter o release conforme o plano aprovado e restaurar banco/objetos a partir dos backups quando necessário. Migrações D1 não devem ser tratadas como reversíveis automaticamente.

## Operação

O cron configurado atualmente é `0 * * * *` (**a cada hora**), limpando limites expirados e eventos antigos de analytics. Verificar CORS, HTTPS, isolamento entre duas lojas, uploads privados, domínio, logs sem segredos e políticas de retenção. Consulte também `PRODUCAO-CHECKLIST.md` e `docs/POLITICA-PRODUCAO.md`.
