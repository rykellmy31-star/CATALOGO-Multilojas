/** Campos que o lojista pode alterar; nunca envie quotas, plano ou IDs. */
export const STORE_SETTINGS_FIELDS = [
  'name', 'slug', 'description', 'logo_url', 'banner_url',
  'primary_color', 'secondary_color', 'accent_color', 'address',
  'city', 'state', 'zip_code', 'phone', 'whatsapp', 'email',
  'instagram', 'facebook', 'website', 'opening_hours',
  'seo_title', 'seo_description', 'seo_keywords'
] as const;

export function createStoreSettingsPayload(
  store: Record<string, unknown>
): Partial<Record<(typeof STORE_SETTINGS_FIELDS)[number], unknown>> {
  const payload: Partial<Record<(typeof STORE_SETTINGS_FIELDS)[number], unknown>> = {};
  for (const field of STORE_SETTINGS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(store, field) && store[field] !== undefined) {
      payload[field] = store[field];
    }
  }
  return payload;
}
