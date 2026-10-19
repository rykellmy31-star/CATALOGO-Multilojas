import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatPrice } from '../../lib/api';
import { Card, Badge, Button } from '../../components/ui/Button';
import { Package, Eye, MousePointer, Star, Tag, Plus, Sparkles, ExternalLink, TrendingUp, AlertCircle } from 'lucide-react';

export default function StoreDashboard() {
  const [data, setData] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/store/dashboard'),
      api.get('/store/settings')
    ]).then(([dash, settings]) => {
      setData(dash.data);
      setStore(settings.data.store);
      if (settings.data.store?.slug) localStorage.setItem('storeSlug', settings.data.store.slug);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Bem-vindo de volta! Aqui está o resumo da sua loja.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/produtos/novo" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-md">
            <Plus className="w-4 h-4" /> Novo Produto
          </Link>
          {store && <a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border bg-white hover:bg-gray-50 font-medium text-sm"><ExternalLink className="w-4 h-4" /> Ver Catálogo</a>}
        </div>
      </div>

      {store?.status === 'suspended' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800"><span className="font-semibold">Loja suspensa</span> — Entre em contato com o Super Administrador.</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Produtos</p><p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalProducts || 0}</p></div>
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center"><Package className="w-5 h-5 text-sky-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats.published || 0} publicados • {stats.draft || 0} rascunhos</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Visualizações</p><p className="text-2xl font-bold text-gray-900 mt-1">{stats.visits || 0}</p></div>
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Eye className="w-5 h-5 text-violet-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Visitas ao catálogo</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cliques WhatsApp</p><p className="text-2xl font-bold text-gray-900 mt-1">{stats.clicks || 0}</p></div>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><MousePointer className="w-5 h-5 text-green-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Interesse nos produtos</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Em Destaque</p><p className="text-2xl font-bold text-gray-900 mt-1">{stats.featured || 0}</p></div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Star className="w-5 h-5 text-amber-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats.onSale || 0} em promoção</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-sky-600" /> Produtos Mais Vistos</h3>
            <Link to="/admin/produtos" className="text-xs font-medium text-sky-600 hover:text-sky-700">Ver todos →</Link>
          </div>
          <div className="space-y-3">
            {data?.topProducts?.length ? data.topProducts.map((p: any) => (
              <Link key={p.id} to={`/admin/produtos/${p.id}/editar`} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition-colors">
                <img src={p.image || 'https://via.placeholder.com/40'} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.views || 0} views • {p.clicks || 0} cliques</p>
                </div>
                <Badge variant="info">{formatPrice(p.price || 0)}</Badge>
              </Link>
            )) : <p className="text-sm text-gray-500 py-8 text-center">Nenhum dado ainda. Publique produtos para começar!</p>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-sky-600 to-violet-600 text-white border-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> IA para Anúncios</h3>
                <p className="text-sky-100 text-sm mt-2 leading-relaxed">Transforme fotos simples em anúncios profissionais. Gere nome, descrição e imagem publicitária com 1 clique.</p>
              </div>
            </div>
            <Link to="/admin/produtos/novo" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-sky-700 font-semibold text-sm hover:bg-sky-50">
              <Sparkles className="w-4 h-4" /> Gerar Anúncio com IA
            </Link>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/produtos/novo" className="p-4 rounded-xl border hover:bg-gray-50 text-center transition-colors">
                <Package className="w-6 h-6 text-sky-600 mx-auto" />
                <p className="text-sm font-medium mt-2">Novo Produto</p>
              </Link>
              <Link to="/admin/banners" className="p-4 rounded-xl border hover:bg-gray-50 text-center transition-colors">
                <Tag className="w-6 h-6 text-violet-600 mx-auto" />
                <p className="text-sm font-medium mt-2">Novo Banner</p>
              </Link>
              <Link to="/admin/categorias" className="p-4 rounded-xl border hover:bg-gray-50 text-center transition-colors">
                <Tag className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-sm font-medium mt-2">Categorias</p>
              </Link>
              <a href={store ? `/loja/${store.slug}` : '#'} target="_blank" rel="noreferrer" className="p-4 rounded-xl border hover:bg-gray-50 text-center transition-colors">
                <Eye className="w-6 h-6 text-amber-600 mx-auto" />
                <p className="text-sm font-medium mt-2">Pré-visualizar</p>
              </a>
            </div>
            {store && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">Link do catálogo:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-white px-2 py-1 rounded border">{window.location.origin}/loja/{store.slug}</code>
                  <button onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/loja/${store.slug}`)} className="text-xs font-medium text-sky-600 hover:text-sky-700">Copiar</button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Produtos Recentes</h3>
        <div className="space-y-2">
          {data?.recentProducts?.length ? data.recentProducts.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('pt-BR')} • <Badge variant={p.status === 'published' ? 'success' : p.status === 'draft' ? 'warning' : 'default'}>{p.status}</Badge></p>
              </div>
              <Link to={`/admin/produtos/${p.id}/editar`} className="text-xs font-medium text-sky-600 hover:text-sky-700">Editar →</Link>
            </div>
          )) : <p className="text-sm text-gray-500 text-center py-4">Nenhum produto ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
