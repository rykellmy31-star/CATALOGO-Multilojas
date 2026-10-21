# Homologação comercial — Catálogo Multiloja

Documento de referência para a branch `desenvolvimento/seguranca-e-implantacao`.
**Não autoriza deploy ou alterações na `main`.**

## Verificação automatizada antes de publicar

O workflow `.github/workflows/validar-projeto.yml` deve concluir com sucesso
em um commit da branch de desenvolvimento.

Etapas obrigatórias:

1. Instalar dependências exatamente pelo lockfile com `npm ci`.
2. Executar a auditoria local `python3 scripts/auditar-seguranca.py`.
3. Verificar dependências com `npm audit --audit-level=moderate`.
4. Executar toda a suíte `npm test` sem falhas.
5. Compilar frontend e backend com `npm run build`.
6. Aplicar migrações **somente no D1 local**, com `npm run db:migrate`.
7. Validar o Worker com `wrangler deploy --dry-run` (sem publicar).
8. Para a homologação de navegador, incluir `[browser ci]` no commit
   de validação ou selecionar `navegador` na execução manual. A suíte usa
   Chromium, D1 e R2 locais, com evidências anexadas no GitHub Actions.

Não confundir os resultados da suíte automatizada com a homologação de
produção: migração, armazenamento e IA reais exigem ambiente autorizado.

## Evidências automatizadas

A aprovação da execução do GitHub Actions no SHA candidato é pré-requisito.
O último ciclo verde confirmado nesta revisão teve **651 testes Vitest
aprovados, build frontend/backend, auditoria de dependências, D1 local,
Worker dry-run, Chromium e R2 local**.

A aprovação não comprova que o `database_id` e os buckets exemplificativos
de `wrangler.toml` existam na conta Cloudflare do proprietário.

## Dependências para homologação e publicação futura

- Configurar, com autorização, IDs reais do D1 e buckets `STORAGE` e
  `STORAGE_PUBLIC`, com permissões mínimas necessárias e backups.
- Associar domínio/HTTPS, origem CORS exata e segredos do Worker
  (`JWT_SECRET`, `SUPER_ADMIN_SETUP_TOKEN`); nunca commitar valores.
- Aplicar as migrações no ambiente autorizado, após backup e validação
  do plano de reversão. Não aplicar migrations no banco real por CI.
- Confirmar que o bucket privado não possui URL pública irrestrita; auditar
  acesso à mídia, cotas e segregação entre lojistas.
- Homologar cadastro, reset de senha, configurações, banner, catálogo e
  carregamento de imagens com pelo menos dois lojistas de teste.
- Validar em dispositivos reais, verificar observabilidade, domínio,
  consentimentos necessários e procedimentos de suporte/restauração.
- IA paga continua desabilitada até aprovação de custo, modelo suportado,
  credencial autorizada, cotas e testes de falha sem geração real em CI.
- Exigir autorização específica antes de fazer deploy, alterar `main`
  ou abrir acesso a clientes pagantes.

## Fluxos de homologação manual, em ambiente de teste

- Criar loja, adicionar e redefinir seu administrador, suspender e reativar.
- Confirmar acesso negado entre lojas nas rotas, dados, imagens e cotas.
- Criar, editar, publicar, arquivar e excluir produtos; conferir galeria.
- Criar categorias e marcas, validar duplicidade e hierarquia sem ciclos.
- Criar banner, programar início/fim, ativar/desativar, observar a vitrine.
- Validar busca, filtros, preço promocional e links do WhatsApp.
- Validar formulários em celular e computador, incluindo estados de erro.
- No Chromium local, confirmar gravação de configurações e categorias, janela de banners e acesso negado de outro lojista a produto e imagem no R2.
- Conferir quotas, trilha de auditoria e mensagens sem expor credenciais.

## Integrações e faturamento

- IA: utilizar simuladores nos testes; **não** fazer chamadas pagas durante CI.
- Cloudflare D1/R2: utilizar recursos locais para os testes automáticos.
- Integrações externas: comprovar autenticação, webhooks e limites em sandbox
  antes de ativar conexões reais. Nunca salvar credenciais no repositório.
- Não realizar pagamentos, contratar serviços nem habilitar cobrança.
- Não aplicar migrações destrutivas ou executar deploy em produção sem
  autorização específica.

## Critério de conclusão

Somente declarar o sistema pronto comercialmente quando o workflow completo
estiver verde, os fluxos críticos tiverem evidências de homologação, as
configurações de produção forem revisadas e houver autorização explícita para
publicação. O percentual de implementação não substitui esses requisitos.
