# Política de publicação e isolamento

## Produção
O código desta branch não deve ser implantado automaticamente. Publicação só após CI verde, revisão de autenticação, migrações D1 verificadas e variáveis de ambiente configuradas.

## Segurança obrigatória
- A criação do primeiro superadmin deve exigir `SUPER_ADMIN_SETUP_TOKEN` aleatório, sem fallback.
- Todas as rotas administrativas devem validar JWT no servidor, consultar o usuário ativo no D1 e verificar papel e loja.
- Identificadores de loja recebidos no corpo, query ou URL nunca substituem o `store_id` autorizado do usuário.
- Uploads R2 devem validar tipo, tamanho e escopo da loja; não confiar apenas no `Content-Type` enviado pelo navegador.
- Toda consulta a produtos, categorias, banners e pedidos privados deve filtrar pela loja autorizada.
- Erros não devem expor segredos, SQL, stack traces ou credenciais.
- CORS deve restringir origens de administração em produção.
- Login deve ter limite de tentativas e mensagens genéricas para credenciais inválidas.

## Verificação de isolamento
1. Criar duas lojas e dois administradores distintos.
2. Garantir que A não consiga ler, editar ou excluir recursos de B alterando IDs nas requisições.
3. Garantir que contas suspensas não consigam criar ou editar dados.
4. Confirmar que o catálogo público mostra apenas produtos publicados da loja solicitada.
5. Testar o acesso direto a cada rota administrativa sem token, com token expirado e com papel incorreto.

## Deploy
Cloudflare Worker: secrets `JWT_SECRET`, `SUPER_ADMIN_SETUP_TOKEN` e chaves de IA via `wrangler secret put` ou painel. Banco D1 e bucket R2 devem ser vinculados por ambiente. Nunca incluir valores reais no Git.
