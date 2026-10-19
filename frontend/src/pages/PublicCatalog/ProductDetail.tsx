import { getDisplayPrice } from '../../lib/pricing';
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { formatPrice, getImageUrl } from '../../lib/api';
import { PublicLayout } from '../../components/layout/Layout';
import { ProductCard } from '../../components/catalog/ProductCard';
import { ArrowLeft, Heart, Share2, MessageCircle, Eye, Package, Truck, Shield, Star } from 'lucide-react';

export default function ProductDetail() {
  const { slug, productSlug } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    api.get(`/public/stores/${slug}/products/${productSlug}`).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, [slug, productSlug]);

  const handleWhatsApp = () => {
    if (!data?.whatsappLink) return;
    api.post(`/public/stores/${slug}/analytics`, { event_type: 'whatsapp_click', product_id: data.product.id }).catch(()=>{});
    window.open(data.whatsappLink, '_blank');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: data.product.name, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
      setShowShare(true);
      setTimeout(()=>setShowShare(false), 2000);
    }
    api.post(`/public/stores/${slug}/analytics`, { event_type: 'share_click', product_id: data.product.id }).catch(()=>{});
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="h-64 w-full max-w-2xl bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (!data?.product) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <Link to={`/loja/${slug}`} className="mt-4 inline-flex px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium">Voltar ao catálogo</Link>
      </div>
    </div>
  );

  const product = data.product;
  const images: any[] = data.images || [];
  const displayPrice = getDisplayPrice(product);
  const hasPromo = displayPrice < product.price;

  const whatsappNumber = data.store.whatsapp ? data.store.whatsapp.replace(/\D/g,'') : '';

  return (
    <PublicLayout store={data.store}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
        </Link>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to={`/loja/${slug}`} className="hover:text-gray-700">{data.store.name}</Link>
          <span>/</span>
          <span>{product.category_name || 'Produto'}</span>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-[1.5rem] overflow-hidden bg-gray-50 border relative">
              <img src={getImageUrl(images[selectedImage]?.url || product.primary_image)} alt={product.name} className="w-full h-full object-cover" />
              {hasPromo && <span className="absolute top-4 left-4 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">OFERTA • Economize {formatPrice(product.price - displayPrice)}</span>}
              {product.is_featured && <span className="absolute top-4 right-4 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1"><Star className="w-4 h-4" /> Destaque</span>}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img: any, idx: number) => (
                  <button key={img.id} onClick={()=>setSelectedImage(idx)} className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-sky-600 shadow-md' : 'border-transparent hover:border-gray-200'}`}>
                    <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                    {img.is_ai_generated && <span className="absolute bottom-0.5 left-0.5 bg-violet-600 text-white text-xs px-1 rounded-full">IA</span>}
                  </button>
                ))}
              </div>
            )}
            {images.some((i:any)=>i.is_ai_generated) && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-600" /> Imagens com marcador "IA" são ilustrativas — foto original também disponível</p>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              {product.category_name && <p className="text-sm font-medium text-sky-600 uppercase tracking-wider">{product.category_name} {product.brand_name && `• ${product.brand_name}`}</p>}
              <h1 className="font-display text-3xl font-bold text-gray-900 leading-tight mt-2">{product.name}</h1>
              {product.sku && <p className="text-xs text-gray-500 mt-2 font-mono">Código: {product.sku} • {product.views || 0} visualizações</p>}
              {product.short_description && <p className="text-gray-600 mt-3 leading-relaxed">{product.short_description}</p>}
            </div>

            <div className="bg-gray-50 rounded-2xl p-6">
              {hasPromo ? (
                <div>
                  <p className="text-sm text-gray-500 line-through">De {formatPrice(product.price)}</p>
                  <p className="text-3xl font-bold text-red-600">{formatPrice(displayPrice)} <span className="text-sm font-normal text-gray-500">à vista</span></p>
                  <p className="text-xs text-green-600 font-medium mt-1">✨ Você economiza {formatPrice(product.price - displayPrice)}</p>
                </div>
              ) : (
                <div>
                  {product.original_price && product.original_price > product.price && <p className="text-sm text-gray-500 line-through">De {formatPrice(product.original_price)}</p>}
                  <p className="text-3xl font-bold text-slate-900">{formatPrice(displayPrice)}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Consulte condições de pagamento e entrega no WhatsApp. Valores podem variar.</p>
            </div>

            {product.description && (
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 text-gray-400" /> Descrição</h3>
                <p className="text-gray-600 leading-relaxed mt-2 whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {(product.dimensions || product.technical_specs) && (
              <div className="grid grid-cols-2 gap-4">
                {product.dimensions && <div className="bg-white rounded-xl border p-4"><p className="text-xs font-medium text-gray-500 uppercase">Dimensões</p><p className="font-medium text-gray-900 mt-1">{product.dimensions}</p></div>}
                {product.technical_specs && <div className="bg-white rounded-xl border p-4"><p className="text-xs font-medium text-gray-500 uppercase">Especificações</p><p className="text-sm text-gray-700 mt-1 line-clamp-3">{product.technical_specs}</p></div>}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleWhatsApp} className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white shadow-lg hover:shadow-xl transition-all" style={{ background: '#25D366' }}>
                <MessageCircle className="w-5 h-5" /> Tenho Interesse • WhatsApp
              </button>
              <button onClick={handleShare} className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border bg-white hover:bg-gray-50 font-medium">
                <Share2 className="w-5 h-5" /> Compartilhar
              </button>
            </div>
            {showShare && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2">Link copiado para a área de transferência!</div>}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-xl border p-3">
                <Truck className="w-6 h-6 text-sky-600 mx-auto" />
                <p className="text-xs font-medium mt-1">Entrega Rápida</p>
                <p className="text-xs text-gray-500">Consulte prazo</p>
              </div>
              <div className="bg-white rounded-xl border p-3">
                <Shield className="w-6 h-6 text-green-600 mx-auto" />
                <p className="text-xs font-medium mt-1">Garantia</p>
                <p className="text-xs text-gray-500">Qualidade garantida</p>
              </div>
              <div className="bg-white rounded-xl border p-3">
                <Eye className="w-6 h-6 text-violet-600 mx-auto" />
                <p className="text-xs font-medium mt-1">Pronta Entrega</p>
                <p className="text-xs text-gray-500">{product.stock_quantity > 0 ? `${product.stock_quantity} un.` : 'Consultar'}</p>
              </div>
            </div>

            {data.store && (
              <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: data.store.primary_color || '#0ea5e9' }}>{data.store.name[0]}</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{data.store.name}</p>
                  <p className="text-xs text-gray-500">Vendido e entregue por esta loja</p>
                </div>
                <Link to={`/loja/${slug}`} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Ver loja</Link>
              </div>
            )}
          </div>
        </div>

        {/* Related */}
        {data.related?.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-bold text-gray-900">Você também pode gostar</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {data.related.map((p:any)=><ProductCard key={p.id} product={p} storeSlug={slug!} />)}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
