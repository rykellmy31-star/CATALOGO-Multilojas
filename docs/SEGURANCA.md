# Segurança

## Autenticação
- bcrypt 12 rounds
- JWT com expiração 7d
- Rate limit em login (5 req/min)
- Sessão via httpOnly cookie opcional

## Isolamento Multi-tenant
- Toda query filtra por store_id
- Middleware tenant valida ownership
- Super admin acessos logados em audit_logs
- Testes automatizados de isolamento

## Proteção
- CORS configurado
- Secure headers (CSP, HSTS)
- Zod validation em todos endpoints
- SQL via prepared statements (sem injection)
- Upload validado (tipo, tamanho)
- Secrets apenas via wrangler secret

## LGPD
- Analytics com ip_hash (não IP puro)
- Sem dados sensíveis nos logs
- Exclusão de loja = soft delete (deleted status)
