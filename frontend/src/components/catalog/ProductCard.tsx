import { getDisplayPrice } from '../../lib/pricing';
import { Link } from 'react-router-dom';
import { formatPrice, getImageUrl } from '../../lib/api';
import { Heart, Eye } from 'lucide-react';

export function ProductCard({ product, storeSlug, variant='default' }: { product: any; storeSlug: string; variant?: string }) {
  const displayPrice = getDisplayPrice(product);
  const hasPromo = displayPrice < product.price;
  const originalPrice = hasPromo ? product.price : product.original_price;

  return (
    <Link to={`/loja/${storeSlug}/produto/${product.slug}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        <img src={getImageUrl(product.primary_image || product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        {hasPromo && <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">OFERTA</span>}
        {product.is_featured ? <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">DESTAQUE</span> : null}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {product.category_name && <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-1">{product.category_name}</p>}
        <h3 className="font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-sky-700 transition-colors">{product.name}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{product.short_description}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            {originalPrice && hasPromo && <p className="text-xs text-gray-400 line-through">{formatPrice(originalPrice)}</p>}
            <p className="text-lg font-bold text-slate-900">{formatPrice(displayPrice)}</p>
            {originalPrice && !hasPromo && originalPrice > displayPrice && <p className="text-xs text-green-600 font-medium">Economize {formatPrice(originalPrice - displayPrice)}</p>}
          </div>
          <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:bg-sky-600 transition-colors">
            <Eye className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-6 bg-gray-100 rounded w-1/2 mt-2" />
      </div>
    </div>
  );
}
