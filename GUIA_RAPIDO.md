# ⚡ Guia Rápido — Catálogos Pro

## 1. Primeiro acesso (após instalação)

1. Rode `npm run dev`
2. Acesse http://localhost:5173/setup
3. Use token padrão dev: `setup-dev-token-change-me`
4. Crie Super Admin: nome, email, senha forte
5. Faça login em /login

## 2. Criar primeira loja

1. Como Super Admin: Vá em Lojas > Nova Loja
2. Preencha: nome, WhatsApp, email, cidade
3. Salve → Clique na loja → Criar Admin da Loja
4. Informe nome, email, senha do lojista
5. Envie credenciais ao lojista

## 3. Como lojista

1. Acesse /login com email/senha da loja
2. Dashboard → Novo Produto
3. Envie fotos, preencha nome, preço, categoria
4. **Opcional IA**: Clique "Gerar com IA" → envie foto → escolha estilo → Gerar
5. Revise nome/descrição sugeridos → Aplicar
6. Escolha imagens geradas → Aprovar
7. Publique (status: Publicado)

## 4. Catálogo público

Link: `seudominio.com/loja/nome-da-loja`

- Compartilhe com clientes
- Clientes clicam "Tenho Interesse" → vai pro WhatsApp da loja
- Lista de interesse: cliente marca vários itens e envia de uma vez

## 5. Personalização

Lojista em Configurações:
- Logo, cores, banners
- WhatsApp, endereço, horário
- Redes sociais

Super Admin em Plataforma:
- Nome da plataforma, cores globais
- Limites de IA e armazenamento
- Texto do rodapé

## 6. Ativar IA (para Super Admin)

1. Obtenha chave OpenAI em platform.openai.com/api-keys
2. Execute: `npx wrangler secret put OPENAI_API_KEY`
3. Cole a chave (sk-proj-...)
4. Defina limites por loja se desejar
5. Teste: crie produto → Gerar com IA

Sem chave configurada: o sistema avisa claramente e não simula geração falsa.

## 7. Teste rápido com dados demo

Login demo:
- Super: super@catalogospro.com / Super123!
- Móveis: admin@moveispremium.com / Loja123!
- Eletro: admin@eletrocenter.com / Loja123!
- Decor: admin@decorart.com / Loja123!

Catálogos:
- /loja/moveis-premium
- /loja/eletro-center
- /loja/decor-art
