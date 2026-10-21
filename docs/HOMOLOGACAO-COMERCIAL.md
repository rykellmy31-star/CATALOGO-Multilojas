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
8. Quando a validação de navegador estiver habilitada, executar
   `npm run test:browser` com Chromium e serviços locais.

Não confundir os resultados da suíte automatizada com a homologação de
produção: migração, armazenamento e IA reais exigem ambiente autorizado.

## Fluxos de homologação manual, em ambiente de teste

- Criar loja, adicionar e redefinir seu administrador, suspender e reativar.
- Confirmar acesso negado entre lojas nas rotas, dados, imagens e cotas.
- Criar, editar, publicar, arquivar e excluir produtos; conferir galeria.
- Criar categorias e marcas, validar duplicidade e hierarquia sem ciclos.
- Criar banner, programar início/fim, ativar/desativar, observar a vitrine.
- Validar busca, filtros, preço promocional e links do WhatsApp.
- Validar formulários em celular e computador, incluindo estados de erro.
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
