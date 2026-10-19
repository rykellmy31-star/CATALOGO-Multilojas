# Continuidade — validação local e economia de Actions

## Alterações

- Removido o gatilho push do workflow: não há mais validação duplicada por push e PR.
- PR em rascunho não aloca runner automaticamente. PR pronto para revisão direcionado à main valida abertura, reabertura, novos commits e transição para pronto.
- Execuções concorrentes da mesma branch são canceladas; há timeout de 15 minutos.
- Execução manual declarada por workflow_dispatch, com Chromium opcional. A modalidade básica possui nome de check diferente, validar-basico-manual, para não se confundir com validar completo.
- Enquanto o workflow não existe na main, a alternativa manual é adicionar explicitamente o rótulo validar-agora ao PR. Nenhum rótulo foi adicionado nem execução manual solicitada nesta rodada.
- Adicionado npm run validate: auditoria estática, testes e build antes do envio ao GitHub.
- Produtos rejeitam preço vazio, nulo, booleano ou negativo, valores promocionais negativos, estoque negativo/fracionário e flags booleanas em formato incorreto.
- Filtros rejeitam limites inválidos ou invertidos. Filtro, ordenação, contagem, cards, detalhe e mensagem de WhatsApp passam a usar o mesmo preço promocional exibido, inclusive zero.
- SKU opcional vazio é normalizado para NULL na edição. Conflitos de unicidade retornam 409 com mensagem de negócio, sem detalhes internos do banco.

## Verificações realmente executadas antes dos commits

1. Primeira etapa: npm run validate aprovado com 19 testes e build frontend/backend.
2. Segunda etapa: npm run validate aprovado com 36 testes e build frontend/backend.
3. Terceira etapa: npm run validate aprovado com 38 testes em três arquivos e build frontend/backend.
4. YAML do workflow carregado e verificado localmente: ausência de push, PR para main, gatilho ready_for_review, concorrência e nome específico da validação manual básica.
5. O GitHub registrou o primeiro commit desta rodada como skipped no workflow do PR em rascunho. Nenhum runner foi solicitado por esta configuração para o rascunho.

Não foram repetidos testes Chromium, auditoria npm de dependências, migrações D1 ou empacotamento Wrangler nesta rodada: não houve alteração de dependências, schema do banco ou configuração do Worker. A evidência anterior de Chromium permanece no histórico e não é apresentada como execução do código novo. O workflow completo deverá validar o SHA candidato antes de integrar à main.

## Pendências e limites

- O botão Run workflow depende de o arquivo existir na branch padrão; hoje ele está apenas na branch de desenvolvimento. A main não foi alterada para habilitar esse botão.
- A leitura da proteção da main retornou 403 pela conexão disponível. Não foi possível verificar a obrigatoriedade do check validar. Antes de qualquer integração, confirmar a proteção e exigir o check completo no SHA candidato.
- Homologação real Cloudflare, domínio e segredos continuam dependentes de autorização. Nenhum deploy, migração remota, segredo, cobrança ou integração à main foi feito.

Commits iniciais desta rodada: a8b5c60 (economia de Actions), 1cbb824 (preços e filtros). O commit que contém este relatório conclui a normalização de SKU e a diferenciação dos checks manuais.
