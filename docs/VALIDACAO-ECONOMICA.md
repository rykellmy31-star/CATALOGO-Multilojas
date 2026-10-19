# Validação local e controle de minutos

Durante o desenvolvimento, executar `npm run validate` antes de enviar qualquer alteração. Isso executa auditoria estática, os testes de integração e o build frontend/backend. Quando houver mudanças de banco ou de configuração Cloudflare, executar também `npm run db:migrate` e `npx wrangler deploy --dry-run --env=''`. Ambos são locais, sem publicação. `npm run test:browser` requer Chromium instalado e usa somente recursos locais e credenciais fictícias.

O workflow não possui gatilho push. PRs em rascunho não alocam runner automaticamente. PRs prontos para revisão direcionados à main executam todas as verificações, incluindo Chromium, em abertura, reabertura, atualização e transição para pronto. Execuções anteriores da mesma branch são canceladas quando há uma nova solicitação.

Validação manual: o workflow declara workflow_dispatch com navegador opcional. O GitHub só disponibiliza o botão Run workflow quando esse arquivo existe na branch padrão; atualmente ele ainda não existe na main, que não foi alterada. Enquanto o PR permanece em rascunho, adicionar explicitamente o rótulo validar-agora ao PR solicita a bateria completa. Para repetir essa solicitação, remover e adicionar novamente o rótulo. Esta execução não adiciona o rótulo nem dispara Actions manualmente.

Antes de integrar à main: tornar o PR pronto para revisão, aguardar o check validar aprovado no SHA atual e revisar o resultado. A obrigatoriedade técnica desse check depende da proteção da branch/regras do repositório. A conexão disponível não permite consultar ou alterar a proteção da main (403); nenhuma proteção é presumida ou alterada aqui.

Não há deploy, uso de segredos reais ou autorização de cobrança neste workflow. Os controles reduzem execuções de Actions; eventual consumo dos minutos disponíveis continua sujeito à configuração da conta GitHub.
