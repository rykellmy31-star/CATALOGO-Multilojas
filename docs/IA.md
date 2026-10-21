# Inteligência Artificial — Guia Completo

## Visão Geral

A plataforma integra OpenAI GPT-4o Vision + DALL·E 3 para:
1. Analisar foto do produto
2. Sugerir nome comercial
3. Gerar descrição longa persuasiva
4. Sugerir categoria
5. Gerar imagem publicitária ilustrativa em 4 estilos

## Estilos

| Estilo | Uso |
|--------|-----|
| `modern_room` | Produto em sala moderna iluminada |
| `white_background` | E-commerce fundo branco |
| `promotional` | Anúncio com cores vibrantes |
| `premium_catalog` | Catálogo luxo editorial |

## Configuração OpenAI

1. Crie conta em https://platform.openai.com
2. Gere chave em https://platform.openai.com/api-keys
3. Adicione crédito (pay-as-you-go)

Configure:

```bash
npx wrangler secret put OPENAI_API_KEY
# Cole: sk-proj-...

# Opcional em wrangler.toml:
# OPENAI_MODEL=gpt-4o
# OPENAI_IMAGE_MODEL=dall-e-3
```

## Custos (estimativa OpenAI 2024)

- Descrição (GPT-4o vision): ~$0.01
- Imagem (DALL·E 3 1024x1024 hd): ~$0.04
- Total por produto: ~$0.05

## Regras de Segurança da IA

- Preserva aparência, cores e modelo reais
- Não inventa especificações técnicas
- Não adiciona marcas falsas
- Imagens geradas marcadas como "ilustrativa"
- Foto original sempre preservada
- Comparação original vs gerada disponível
- Aprovação humana obrigatória antes de publicar
- Geração pode ser refeita
- Consumo registrado em `ai_generations` para auditoria

## Limites

Configuráveis por loja no Super Admin:
- `ai_daily_limit` (padrão 10)
- `ai_monthly_limit` (padrão 100)

Se limite atingido: retorna 429.

## Sem IA Configurada

Se `OPENAI_API_KEY` ausente:
- Botão de geração exibe aviso claro
- Retorna 503 com mensagem explicativa
- Nunca simula geração falsa
- Cadastro manual continua 100% funcional

## Trocar Provedor

Edite `backend/src/services/ai.ts` para suportar Anthropic/Google.
Defina `AI_PROVIDER` em vars.

## Monitoramento

Super Admin Dashboard mostra:
- Total de gerações
- Custo estimado
- Histórico por loja
