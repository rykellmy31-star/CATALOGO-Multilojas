#!/bin/bash
set -e

echo "🚀 Catálogos SaaS - Setup Inicial"
echo "================================"

if ! command -v wrangler &> /dev/null; then
  echo "Instalando wrangler..."
  npm install -g wrangler
fi

if [ ! -f ".dev.vars" ]; then
  echo "Criando .dev.vars a partir de .env.example..."
  cp .env.example .dev.vars
  echo "⚠️  Edite .dev.vars com suas chaves antes de continuar!"
  echo "   Especialmente: JWT_SECRET, SUPER_ADMIN_SETUP_TOKEN, OPENAI_API_KEY"
fi

echo ""
echo "1. Criando banco D1..."
npx wrangler d1 create catalogos_db || echo "Banco já existe ou erro - verifique se já foi criado"

echo ""
echo "2. Criando buckets R2..."
npx wrangler r2 bucket create catalogos-storage || echo "Bucket já existe"
npx wrangler r2 bucket create catalogos-public || echo "Bucket já existe"

echo ""
echo "3. Aplicando schema..."
npx wrangler d1 execute catalogos_db --file=./database/schema.sql --local || echo "Erro ao aplicar schema local"

echo ""
echo "4. Aplicando seed..."
npx wrangler d1 execute catalogos_db --file=./database/seed.sql --local || echo "Erro ao aplicar seed"

echo ""
echo "✅ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  - Edite .dev.vars com JWT_SECRET forte"
echo "  - Rode: npm run dev"
echo "  - Acesse: http://localhost:5173/setup para criar Super Admin"
echo "  - Ou use: http://localhost:5173/login com demo: super@catalogospro.com / Super123!"
