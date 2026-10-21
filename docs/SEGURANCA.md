# Segurança — estado implementado e critérios de produção

## Autenticação

- Senhas armazenadas com bcrypt; tokens JWT HS256 com validade padrão de 7 dias.
- JWT só é aceito quando o segredo possui no mínimo 32 caracteres, o usuário continua ativo, a versão da sessão corresponde à do D1 e a loja está ativa.
- A revogação por logout ou redefinição de senha incrementa a versão da sessão no D1.
- Limite de login e bootstrap: **20 solicitações por IP/caminho em 15 minutos**, contador persistente no D1 com identificador derivado por hash, sem gravar IP bruto. Falha na configuração de JWT deve responder 503 antes de acessar o banco.
- **Não** há cookie de sessão httpOnly implementado: o frontend atual usa token no `localStorage`. Revisar risco de XSS e controles do navegador antes da abertura comercial.

## Isolamento multiloja

- As rotas administrativas validam o papel e o escopo de loja no servidor.
- Queries e vínculos de recursos críticos verificam `store_id`, com testes de referências cruzadas e de acesso a imagens de outra loja.
- O superadministrador tem escopo privilegiado; visualizar dados de suporte exige auditoria bem-sucedida antes de responder.

## Proteções em vigor

- Cabeçalhos de segurança e CORS limitado a origens explicitamente permitidas no backend.
- Entradas e uploads são validados, com consultas parametrizadas e verificação de imagens.
- Segredos reais nunca devem ser armazenados no Git; o CI examina arquivos versionados e executa auditoria de dependências.
- O sistema registra eventos de analytics com hash de identificadores, aplica limites de abuso e limpa registros expirados por cron.

## Limites da comprovação

A suíte local não substitui testes de penetração, revisão externa, backup/restauração, validação remota de D1/R2, política LGPD, testes em dispositivos reais e homologação operacional. Ver `docs/HOMOLOGACAO-COMERCIAL.md`.
