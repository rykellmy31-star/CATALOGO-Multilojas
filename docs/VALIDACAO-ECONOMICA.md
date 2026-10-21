# Validação segura e econômica — Catálogo Multiloja

O repositório é público. O proprietário autorizou GitHub Actions em executores
padrão para a branch `desenvolvimento/seguranca-e-implantacao`, sem despesas
extras, alteração da `main` ou deploy automático.

## Como a validação é executada

- Commits normais na branch de desenvolvimento disparam um workflow de CI.
- Commits com `[skip ci]` não disparam o CI: úteis para ajustes intermediários.
- Acrescente `[browser ci]` à mensagem do commit final da rodada para também
  executar Chromium e os fluxos de D1/R2 inteiramente locais.
- `workflow_dispatch` permite executar manualmente e selecionar `navegador`,
  quando disponível no GitHub. O workflow existe na branch de desenvolvimento;
  o botão manual pode não aparecer enquanto ela não for a branch padrão.
- O CI só usa `ubuntu-latest` e permissões `contents: read`. Não acessa
  bancos remotos, não gera imagens em APIs comerciais e não publica o Worker.

## Etapas obrigatórias

1. `python3 scripts/auditar-seguranca.py`: verifica arquivos sigilosos
   versionados, segredos conhecidos, configurações e autenticação básica.
2. `npm ci`: restaura dependências exatamente como no lockfile.
3. `npm audit --audit-level=moderate`: avalia vulnerabilidades.
4. `npm test`: executa Vitest e regressões multiloja.
5. `npm run build`: checa tipos e empacota frontend e backend.
6. `npm run db:migrate`: aplica migrações **somente no D1 local**.
7. `npx wrangler deploy --dry-run --env='' --outdir /tmp/catalogo-worker`:
   verifica o empacotamento sem implantar.
8. Opcionalmente, `npm run test:browser`: Chromium, dados fictícios, Worker,
   D1 e R2 locais. Evidências em artefatos da execução.

Uma falha interrompe as etapas posteriores. O resultado verde significa
aprovação dessa revisão do código, não validação de credenciais, cotas e
integrações de produção.

## Limites obrigatórios

Não há autorização para runners maiores pagos, assinatura, métodos de
pagamento, uso real de IA paga, deploy em produção, exclusão de dados ou
migrações remotas. Se um ambiente real pedir cobrança, parar só aquela etapa
e continuar testes locais. O PR deve permanecer sem merge até a autorização
para integrar à `main`.

## Homologação comercial

Ver `docs/HOMOLOGACAO-COMERCIAL.md` para as verificações externas ainda
necessárias: recursos Cloudflare próprios, segredos, domínio, permissões,
acesso de lojistas, apresentação em navegadores/dispositivos reais,
auditoria e aprovação comercial.
