# Cloudflare — recursos e segurança

A configuração de `wrangler.toml` declara um Worker, um banco D1 (`catalogos_db`), dois buckets R2 (`STORAGE` e `STORAGE_PUBLIC`) e Worker Assets para o frontend.

Os IDs/buckets existentes no repositório são exemplos para desenvolvimento. **Não** correspondem necessariamente a recursos da conta do proprietário. A criação/configuração de recursos remotos pode gerar custos e exige autorização prévia.

Secrets mínimos: `JWT_SECRET` e `SUPER_ADMIN_SETUP_TOKEN`; IA desativada por padrão (`AI_ENABLED=false`). Nunca commitar credenciais ou expor publicamente `STORAGE`.

O cron de limpeza configurado é **horário** (`0 * * * *`) e remove rate limits expirados e eventos antigos de analytics. Reavaliar retenção e alertas em homologação.

Procedimento de instalação e migração remota, backups, CORS e liberação comercial: `docs/CLOUDFLARE.md` e `docs/HOMOLOGACAO-COMERCIAL.md`. O CI somente valida a branch de desenvolvimento, sem deploy.
