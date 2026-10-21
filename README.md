# Catálogo Multilojas

SaaS de catálogos com React, Hono, Cloudflare Workers, D1 e R2.

## Funcionalidades

- Primeiro Super Administrador com token privado e unicidade no banco.
- Gestão de lojas, administradores, configuração da plataforma e auditoria.
- Painel de loja com produtos, imagens, categorias, marcas, banners e estatísticas.
- Catálogo público com busca, filtros, paginação, detalhes e contato por WhatsApp.
- Isolamento por loja na autenticação, consultas, uploads e referências do banco.
- Revogação de sessões no logout e na redefinição de senha; limite de login persistido no D1.
- IA opcional, desativada na configuração inicial. Requer configuração e validação específicas antes de uso real.

## Validação local

Node 22.13 ou superior.

```sh
npm ci
npm run validate
npm run db:migrate
npx wrangler deploy --dry-run --outdir /tmp/catalogo-worker
npm run dev
```

As migrações usam `--local`. Não executar o seed demonstrativo em produção.
Para autenticação em desenvolvimento, fornecer valores aleatórios próprios de pelo menos 32 caracteres para `JWT_SECRET` e `SUPER_ADMIN_SETUP_TOKEN` em `.dev.vars`, que é ignorado pelo Git. O frontend usa `/api` e o Vite encaminha as chamadas para o Worker local.

## Implantação futura

A configuração atual tem identificador D1 local e nomes de buckets exemplificativos. Antes de qualquer implantação autorizada, associar os recursos de homologação, configurar segredos exclusivos e origens CORS exatas, aplicar as migrações em ordem e validar os fluxos completos nesse ambiente. O banco deve começar pelas migrações em `database/migrations`, e não pelo schema isolado seguido novamente das migrações.

O Worker serve a SPA pelo binding `ASSETS`, encaminha `/api/*` à API e exporta o handler de manutenção agendada. O GitHub Actions valida automaticamente **somente commits na branch de desenvolvimento** e aceita execução manual quando disponível. O pipeline cobre auditoria de segredos, dependências, testes, build, migrações D1 locais e empacotamento sem publicação. O Chromium é executado quando o commit contém `[browser ci]` ou na execução manual com a opção `navegador`. Não existe deploy automático.

## Limites e homologação

- Recuperação de acesso da loja é feita pelo Super Administrador; não há envio automático de email de recuperação.
- Uploads e integrações externas precisam de homologação com recursos reais autorizados.
- Imagens de produtos publicadas podem ser consultadas sem autenticação; imagens de rascunhos no bucket privado não são servidas publicamente pela API. Não configurar um domínio público irrestrito para esse bucket.
- Limites e cobrança de IA exigem validação separada de concorrência/custos antes de ativação comercial.
- A validação com Chromium e Worker local cobre login, produtos, prévia, R2, catálogo móvel, configurações, categorias, banners e isolamento entre lojas usando dados fictícios. A homologação em Cloudflare e a aprovação visual em aparelhos reais continuam necessárias antes do lançamento.

Para desenvolver com economia de minutos e escolher a validação manual, consulte [VALIDACAO-ECONOMICA.md](docs/VALIDACAO-ECONOMICA.md). O relatório desta continuação está em [CONTINUIDADE-VALIDACAO-LOCAL.md](docs/CONTINUIDADE-VALIDACAO-LOCAL.md).

Regra vigente: GitHub Actions com executores padrão gratuitos autorizado para validação da branch de desenvolvimento, sem runners pagos, deploy automático, pagamentos ou ampliação de orçamento. Commits `[skip ci]` podem ser usados em ajustes intermediários para evitar execuções redundantes. `main` permanece intocada sem autorização específica.
