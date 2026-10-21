# Preparação para produção — Catálogo Multilojas

## Situação
O repositório ainda não contém o código-fonte do ZIP original. A implantação em produção **não está autorizada** até a importação e a aprovação dos testes.

## Bloqueios de segurança identificados no ZIP
1. Em `backend/src/routes/auth.ts`, remover o fallback `setup-dev-token-change-me`. Exigir `SUPER_ADMIN_SETUP_TOKEN` com pelo menos 32 caracteres antes do primeiro cadastro.
2. Exigir `JWT_SECRET` aleatório com pelo menos 32 caracteres, configurado por secret da Cloudflare.
3. Impedir credenciais de demonstração em produção; exigir hashes bcrypt reais.
4. Revisar autorização multi-tenant em todos os endpoints e uploads.
5. Não colocar tokens, chaves de IA ou segredos no repositório.

## Critérios para publicar
- [ ] Código-fonte completo importado
- [ ] `npm ci`, testes e build concluídos
- [ ] Testes reais de login, isolamento de lojas e cadastro de produtos
- [ ] D1 e R2 provisionados e vinculados
- [ ] Segredos configurados no ambiente Cloudflare
- [ ] Super administrador criado com token único e revogação posterior
- [ ] Catálogo público testado em celular
- [ ] Deploy com rollback documentado

## Fluxo
Trabalhar nesta branch e integrar à `main` somente após validação. Não ativar publicação automática de uma aplicação incompleta.
