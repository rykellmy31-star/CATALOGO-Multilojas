// ============================================
// AI SERVICE - Integração real com OpenAI
// ============================================

export interface AIConfig {
  enabled: boolean;
  provider: string;
  apiKey?: string;
  model: string;
  imageModel: string;
}

export interface AIGenerationResult {
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  suggestedPrice?: number;
  characteristics?: string;
  imageUrl?: string;
  model: string;
  cost: number;
}

export const AI_STYLES = {
  modern_room: {
    label: 'Ambiente Moderno',
    prompt: 'Professional commercial photography of this product placed in a modern, bright, elegantly decorated living room with natural lighting, minimalist decor, high-end interior design magazine quality',
    description: 'Produto em ambiente moderno e iluminado'
  },
  white_background: {
    label: 'Fundo Branco',
    prompt: 'Professional e-commerce product photography on pure white background, studio lighting, shadows, commercial catalog quality, centered',
    description: 'Fundo branco profissional estilo e-commerce'
  },
  promotional: {
    label: 'Anúncio Promocional',
    prompt: 'Eye-catching promotional advertisement design featuring this product with vibrant colors, promotional badge, modern graphic elements, retail poster style',
    description: 'Anúncio promocional chamativo'
  },
  premium_catalog: {
    label: 'Catálogo Premium',
    prompt: 'Luxury premium catalog photography, elegant staging, sophisticated lighting, high-end brand aesthetic, editorial quality',
    description: 'Catálogo premium sofisticado'
  }
} as const;

export async function generateProductDescription(
  config: AIConfig,
  imageUrl: string,
  storeContext?: string
): Promise<AIGenerationResult> {
  if (!config.enabled || !config.apiKey) {
    throw new Error('IA não configurada. Configure sua chave OpenAI nas variáveis de ambiente.');
  }

  // Chamada real para OpenAI GPT-4o Vision
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em marketing e copywriting para e-commerce brasileiro. 
Analise a imagem do produto e gere:
1. Um nome comercial atrativo (máx 60 caracteres)
2. Descrição curta (1 frase, máx 120 caracteres)
3. Descrição completa (3-4 parágrafos, persuasiva, destacando benefícios, materiais e usos)
4. Categoria sugerida (ex: Sofás, Mesas, Geladeiras, etc)
5. Características técnicas observáveis (não invente especificações que não pode ver)

REGRAS:
- Preserve aparência, cores e modelo reais
- Não invente marcas ou especificações técnicas
- Se não tiver certeza, diga "verificar com fornecedor"
- Tom profissional, elegante e comercial
- Responda em JSON válido com chaves: name, shortDescription, description, category, characteristics

Contexto da loja: ${storeContext || 'Loja de móveis e eletrodomésticos'}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem e gere as informações comerciais do produto:'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na API OpenAI: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error('Resposta vazia da IA');

  const parsed = JSON.parse(content);
  
  return {
    name: parsed.name,
    shortDescription: parsed.shortDescription || parsed.short_description,
    description: parsed.description,
    category: parsed.category,
    characteristics: parsed.characteristics,
    model: config.model,
    cost: 0.01 // custo estimado GPT-4o vision
  };
}

export async function generateProductImage(
  config: AIConfig,
  originalImageUrl: string,
  style: keyof typeof AI_STYLES = 'modern_room',
  productName?: string
): Promise<{ imageUrl: string; model: string; cost: number }> {
  if (!config.enabled || !config.apiKey) {
    throw new Error('IA não configurada. Configure sua chave OpenAI.');
  }

  const styleConfig = AI_STYLES[style];
  
  // Para preservar o produto, usamos prompt descritivo + DALL-E 3
  // Em produção ideal: usar GPT Image 1 com image edit (preserva melhor)
  const prompt = `${styleConfig.prompt}. Product to showcase: ${productName || 'furniture/appliance product'}. IMPORTANT: Keep the product appearance, colors and model exactly as in the original. Do not add logos or change essential characteristics. Photorealistic, 8k, highly detailed.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.imageModel || 'dall-e-3',
      prompt: prompt.slice(0, 1000), // DALL-E limit
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'natural'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao gerar imagem: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

  if (!imageUrl) throw new Error('Nenhuma imagem gerada');

  return {
    imageUrl,
    model: config.imageModel || 'dall-e-3',
    cost: 0.04
  };
}

// Função unificada: gera nome+descrição+imagem
export async function generateFullAd(
  config: AIConfig,
  imageUrl: string,
  style: keyof typeof AI_STYLES,
  storeContext?: string
): Promise<AIGenerationResult> {
  const description = await generateProductDescription(config, imageUrl, storeContext);
  
  let imageResult;
  try {
    imageResult = await generateProductImage(config, imageUrl, style, description.name);
  } catch (e) {
    console.warn('Falha ao gerar imagem, retornando apenas descrição:', e);
  }

  return {
    ...description,
    imageUrl: imageResult?.imageUrl,
    cost: (description.cost || 0) + (imageResult?.cost || 0)
  };
}
