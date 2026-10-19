# Validação local sem execuções automáticas

Regra vigente: trabalhar sem gerar custos extras. Testes e build são executados no ambiente de desenvolvimento antes de enviar os commits. Não disparar GitHub Actions, serviços pagos, contratação de planos, cadastro de pagamento ou aumento de orçamento. Se uma etapa exigir pagamento, suspender somente essa etapa, explicar alternativa gratuita e continuar as demais tarefas locais.

Executar `npm run validate` para auditoria estática, testes de integração e build frontend/backend. Quando houver mudanças de banco ou configuração Cloudflare, validar migrações e empacotamento apenas localmente. Não publicar nem usar banco remoto ou chaves reais. Chromium é opcional e pode ser executado localmente quando disponível; não solicitar execução em runner hospedado como alternativa automática.

O workflow possui SOMENTE workflow_dispatch. Não possui gatilhos push, pull_request, rótulos ou agendamento. Envio de commits, abertura/atualização do PR e transição para pronto não solicitam validação de Actions. O rótulo validar-agora não tem mais efeito.

A definição de validação manual foi preservada, com navegador opcional. Ela não foi acionada. O GitHub exige que o arquivo esteja na branch padrão para mostrar o botão Run workflow; hoje ele está apenas na branch de desenvolvimento. A main não será alterada para habilitar o botão sem autorização. Enquanto isso, a alternativa sem Actions é npm run validate no ambiente de desenvolvimento e revisão das evidências registradas no PR.

Uma eventual execução manual hospedada pode consumir a franquia de minutos do GitHub. Não presumir gratuidade nem iniciar sem autorização específica compatível com o limite de custos. Não configurar cobrança para viabilizá-la.

Antes de integrar à main, revisar as evidências locais do SHA candidato e o resultado da validação manual que for autorizada. O workflow continua contendo auditoria de dependências, testes, build, D1 local, empacotamento sem publicação e Chromium opcional, sem ativar execução automática. A conexão disponível não permite confirmar ou alterar a proteção da main (403). Nenhum check obrigatório ou proteção é presumido, removido ou modificado por esta alteração.
