export function getDisplayPrice(product: { price: number; promotional_price?: number | null }): number {
  return product.promotional_price != null && product.promotional_price >= 0 && product.promotional_price < product.price
    ? product.promotional_price : product.price;
}
