import { getDisplayPrice } from '../../lib/pricing';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api, { formatPrice, getImageUrl } from '../../lib/api';
import { PublicLayout } from '../../components/layout/Layout';
import { ProductCard, ProductCardSkeleton } from '../../components/catalog/ProductCard';
import { Search, SlidersHorizontal, X, Star, Tag, Eye, Heart } from 'lucide-react';

export default function Catalog() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState(searchParams.get('q') || '');
  const [selectedCat, setSelectedCat] = useState(searchParams.get('categoria') || '');
  const [sort, setSort] = useState('newest');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [interestList, setInterestList] = useState<string[]>([]);

  const [interestProducts, setInterestProducts] = useState<any[]>([]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(`interestList:${slug}`) || '[]'); setInterestProducts(Array.isArray(saved) ? saved : []); setInterestList(Array.isArray(saved) ? saved.map(p => p.id) : []); } catch { setInterestList([]); setInterestProducts([]); }
    setStore(null);
  }, [slug]);

  const fetchStore = async () => {
    try {
      const { data } = await api.get(`/public/stores/${slug}`);
      setStore(data.store);
      setCategories(data.categories || []);
      setBanners(data.banners || []);
      setFeatured(data.featured || []);
    } catch { /* not found */ }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: searchParams.get('page') || 1,
        limit: 12,
        sort,
      };
      if (searchParams.get('q')) params.q = searchParams.get('q');
      if (searchParams.get('categoria') || selectedCat) params.category = searchParams.get('categoria') || selectedCat;
      if (priceRange.min) params.minPrice = priceRange.min;
      if (priceRange.max) params.maxPrice = priceRange.max;

      const { data } = await api.get(`/public/stores/${slug}/products`, { params });
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch {} finally { setLoading(false); }
  };

  useEffect(()=>{ fetchStore(); }, [slug]);
  useEffect(()=>{ fetchProducts(); }, [slug, searchParams, sort, priceRange, selectedCat]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: any = {};
    if (searchQ) params.q = searchQ;
    if (selectedCat) params.categoria = selectedCat;
    setSearchParams(params);
  };

  const handleCategory = (catSlug: string) => {
    setSelectedCat(catSlug);
    const params: any = {};
    if (searchQ) params.q = searchQ;
    if (catSlug) params.categoria = catSlug;
    setSearchParams(params);
  };

  const toggleInterest = (productId: string) => {
    const updated = interestList.includes(productId) ? interestList.filter(id=>id!==productId) : [...interestList, productId];
    setInterestList(updated);
    const selected = updated.includes(productId) ? [...interestProducts, products.find(p=>p.id===productId)].filter(Boolean) : interestProducts.filter(p=>p.id!==productId);
    setInterestProducts(selected);
    localStorage.setItem(`interestList:${slug}`, JSON.stringify(selected));
  };

  const sendInterestList = () => {
    if (!store || interestList.length === 0) return;
    const wa = store.whatsapp?.replace(/\D/g,'');
    if (!wa) return;
    let msg = `Olá! Tenho interesse nos seguintes produtos da ${store.name}:\n\n`;
    interestProducts.forEach(p=>{
      msg += `• ${p.name} - ${formatPrice(getDisplayPrice(p))} - ${window.location.origin}/loja/${slug}/produto/${p.slug}\n`;
    });
    msg += `\n\nGostaria de mais informações!`;
    // Analytics
    api.post(`/public/stores/${slug}/analytics`, { event_type: 'interest_list', metadata: { count: interestList.length } }).catch(()=>{});
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!store && !loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">🏪</div>
          <h1 className="text-2xl font-bold mt-4">Loja não encontrada</h1>
          <p className="text-gray-500 mt-2">Verifique o link ou entre em contato com o suporte.</p>
          <Link to="/login" className="mt-6 inline-flex px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium">Ir para Plataforma</Link>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout store={store} categories={categories}>
      {/* Hero Banner */}
      {banners.length > 0 && !searchParams.get('q') && !selectedCat && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-slate-900 to-sky-700 text-white">
            <img src={banners[0].image_url} alt={banners[0].title} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60" />
            <div className="relative p-8 sm:p-12 lg:p-16">
              <span className="inline-flex px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">OFERTA ESPECIAL</span>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mt-4 max-w-xl leading-tight">{banners[0].title || `Bem-vindo à ${store?.name}`}</h1>
              <p className="text-sky-100 mt-3 max-w-xl">{banners[0].subtitle || store?.description || 'Produtos selecionados com qualidade e preço justo.'}</p>
              {banners[0].button_text && <Link to={banners[0].link_url || '#'} className="mt-6 inline-flex px-8 py-3 rounded-full bg-white text-slate-900 font-bold hover:bg-gray-100 transition-colors">{banners[0].button_text}</Link>}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar produtos..." className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white shadow-sm" />
          </div>
          <button type="submit" className="px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors">Buscar</button>
          <button type="button" onClick={()=>setShowFilters(!showFilters)} className="p-3.5 rounded-2xl border bg-white hover:bg-gray-50">
            <SlidersHorizontal className="w-5 h-5 text-gray-600" />
          </button>
        </form>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 rounded-2xl border bg-white shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-gray-700">Preço mínimo</label>
              <input type="number" placeholder="0" value={priceRange.min} onChange={e=>setPriceRange({...priceRange, min: e.target.value})} className="mt-1 w-32 px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Preço máximo</label>
              <input type="number" placeholder="5000" value={priceRange.max} onChange={e=>setPriceRange({...priceRange, max: e.target.value})} className="mt-1 w-32 px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Ordenar</label>
              <select value={sort} onChange={e=>setSort(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-sky-500 outline-none">
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="name">Nome A-Z</option>
              </select>
            </div>
            <button onClick={()=>{setPriceRange({min:'', max:''}); setSort('newest'); setSelectedCat(''); setSearchQ(''); setSearchParams({});}} className="px-4 py-2 rounded-xl border hover:bg-gray-50 text-sm">Limpar</button>
          </div>
        )}

        {(searchParams.get('q') || selectedCat) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">{pagination.total} resultados</span>
            {searchParams.get('q') && <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 font-medium">Busca: "{searchParams.get('q')}"</span>}
            {selectedCat && <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 font-medium flex items-center gap-1">{selectedCat} <button onClick={()=>handleCategory('')}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      {/* Featured */}
      {featured.length > 0 && !searchParams.get('q') && !selectedCat && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2"><Star className="w-6 h-6 text-amber-500" /> Destaques</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {featured.slice(0,4).map(p=><ProductCard key={p.id} product={p} storeSlug={slug!} />)}
          </div>
        </div>
      )}

      {/* All Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            {searchParams.get('q') || selectedCat ? 'Resultados' : 'Todos os Produtos'}
          </h2>
          <span className="text-sm text-gray-500">{pagination.total} produtos</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {[1,2,3,4,5,6,7,8].map(i=><ProductCardSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">🔍</div>
            <h3 className="font-semibold text-gray-900 mt-4">Nenhum produto encontrado</h3>
            <p className="text-sm text-gray-500 mt-1">Tente ajustar sua busca ou navegue pelas categorias.</p>
            <button onClick={()=>{setSearchQ(''); setSelectedCat(''); setSearchParams({}); setPriceRange({min:'',max:''});}} className="mt-4 px-6 py-2.5 rounded-xl border font-medium hover:bg-gray-50">Limpar filtros</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
              {products.map(p => (
                <div key={p.id} className="relative">
                  <ProductCard product={p} storeSlug={slug!} />
                  <button onClick={()=>toggleInterest(p.id)} className={`absolute top-2 right-2 p-2 rounded-full shadow-md transition-colors ${interestList.includes(p.id) ? 'bg-red-500 text-white' : 'bg-white text-gray-400 hover:text-red-500'}`}>
                    <Heart className={`w-4 h-4 ${interestList.includes(p.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button disabled={pagination.page <= 1} onClick={()=>setSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(pagination.page - 1) })} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50 text-sm font-medium">Anterior</button>
                <span className="text-sm text-gray-600 px-4">Página {pagination.page} de {pagination.pages}</span>
                <button disabled={pagination.page >= pagination.pages} onClick={()=>setSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(pagination.page + 1) })} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50 text-sm font-medium">Próxima</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Interest List Bar */}
      {interestList.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{interestList.length} produto(s) na lista</p>
            <p className="text-xs text-slate-300">Envie todos de uma vez no WhatsApp</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{setInterestList([]); setInterestProducts([]); localStorage.removeItem(`interestList:${slug}`);}} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
              <X className="w-4 h-4" />
            </button>
            <button onClick={sendInterestList} className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm">
              Enviar
            </button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
