import { z } from 'zod';

export const publicLinkSchema = z.string().max(4096).refine(value => {
  if (!value) return true;
  if (value.includes('\\') || /[\u0000-\u0020]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Use uma URL http/https ou caminho local seguro');

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72)
});

export const setupSuperAdminSchema = z.object({
  setupToken: z.string().min(1, 'Token obrigatório'),
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72)
});

export const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  accent_color: z.string().optional(),
  storage_limit_mb: z.number().int().min(1).max(102400).optional(),
  ai_enabled: z.boolean().optional(),
  ai_daily_limit: z.number().int().min(0).max(10000).optional(),
  ai_monthly_limit: z.number().int().min(0).max(100000).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional()
});

const nonNegativeAmount = z.preprocess(
  value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) ? value : undefined,
  z.coerce.number().finite().min(0, 'Valor não pode ser negativo')
);

export const createProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z.string().optional(),
  short_description: z.string().optional(),
  description: z.string().optional(),
  price: nonNegativeAmount,
  original_price: nonNegativeAmount.optional().nullable(),
  promotional_price: nonNegativeAmount.optional().nullable(),
  category_id: z.string().optional().nullable(),
  brand_id: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived', 'out_of_stock']).default('draft'),
  is_featured: z.boolean().optional().default(false),
  is_on_sale: z.boolean().optional().default(false),
  stock_quantity: z.coerce.number().finite().int().min(0).optional().default(0),
  dimensions: z.string().optional().nullable(),
  technical_specs: z.string().optional().nullable(),
  variations: z.string().optional().nullable(),
  images: z.array(publicLinkSchema).max(50).optional()
});

export const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional(),
  parent_id: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional()
});

export const createBrandSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional()
});

export const createBannerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  image_url: publicLinkSchema.refine(value => value.length > 0, 'Imagem obrigatória'),
  link_url: publicLinkSchema.optional(),
  button_text: z.string().optional(),
  position: z.enum(['hero', 'secondary', 'footer', 'popup']).default('hero'),
  is_active: z.boolean().optional().default(true),
  sort_order: z.coerce.number().optional()
});

export const aiGenerateSchema = z.object({
  product_id: z.string().optional(),
  image_url: publicLinkSchema.refine(value => value.length > 0, 'Imagem obrigatória'),
  style: z.enum(['modern_room', 'white_background', 'promotional', 'premium_catalog']).default('modern_room'),
  generate_description: z.boolean().optional().default(true),
  generate_image: z.boolean().optional().default(true)
});

export const storeAdminSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72)
});
