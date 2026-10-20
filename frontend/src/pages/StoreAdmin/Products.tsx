import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatPrice } from '../../lib/api';
import { Card, Badge, Button, Input } from '../../components/ui/Button';
import AdminImage from '../../components/AdminImage';
import { Plus, Search, Edit, Copy, Trash2, Eye, Download, Upload, Filter, Star, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [pagination, setPagination] = useState<any>({ page: 1, total: 0, pages: 1 });
  const productsController = useRef<AbortController | null>(null);

  const fetchProducts = async (page=1) => {
    // Evita que uma resposta antiga substitua uma busca mais recente.
    productsController.current?.abort();
    const controller = new AbortController();
    productsController.current = controller;
    setLoading(true);
    try {
      const { data } = await api.get('/store/products', {
        params: { q, status, page, limit: 20 },
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      setProducts(data.products || []);
      setPagination(data.pagination || { page, total: 0, pages: 1 });
    } catch {
      if (!controller.signal.aborted) toast.error('Não foi possível carregar os produtos');
    } finally {
      if (productsController.current === controller) {
        productsController.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProducts(1);
    return () => {
      productsController.current?.abort();
      productsController.current = null;
    };
  }, [q, status]);

  const handleDuplicate = async (id: string) => {
    try { await api.post(`/store/products/${id}/duplicate`); toast.success('Produto duplicado!'); fetchProducts(); } catch { toast.error('Erro ao duplicar'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    try { await api.delete(`/store/products/${id}`); toast.success('Produto removido'); fetchProducts(); } catch { toast.error('Erro ao remover'); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/store/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'produtos.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exportado!');
    } catch { toast.error('Erro ao exportar'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 mt-1">{pagination.total} produtos • Gerencie seu catálogo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
          <Link to="/admin/produtos/novo" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-md">
            <Plus className="w-4 h-4" /> Novo Produto
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome, SKU ou descrição..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none" />
          </div>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white min-w-[160px]">
            <option value="all">Todos os status</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunhos</option>
            <option value="out_of_stock">Sem estoque</option>
            <option value="archived">Arquivados</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i=><div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mt-4">Nenhum produto encontrado</h3>
          <p className="text-sm text-gray-500 mt-1">Tente ajustar os filtros ou crie seu primeiro produto.</p>
          <Link to="/admin/produtos/novo" className="mt-4 inline-flex px-6 py-2.5 rounded-xl bg-sky-600 text-white font-medium">Criar Produto</Link>
        </Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(p => (
              <Card key={p.id} hover className="overflow-hidden flex flex-col">
                <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                  <AdminImage url={p.primary_image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    {p.is_featured ? <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">★ Destaque</span> : null}
                    {p.is_on_sale ? <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">Promo</span> : null}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant={p.status === 'published' ? 'success' : p.status === 'draft' ? 'warning' : 'default'}>{p.status === 'published' ? 'Publicado' : p.status === 'draft' ? 'Rascunho' : p.status}</Badge>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs font-medium text-sky-600 uppercase tracking-wider">{p.category_name || 'Sem categoria'}</p>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug">{p.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1 mt-1">{p.short_description || p.sku || 'Sem SKU'}</p>
                  <div className="mt-3">
                    {p.promotional_price && p.promotional_price < p.price ? (
                      <div><span className="text-xs text-gray-400 line-through">{formatPrice(p.price)}</span><span className="ml-2 text-base font-bold text-red-600">{formatPrice(p.promotional_price)}</span></div>
                    ) : (
                      <span className="text-base font-bold text-gray-900">{formatPrice(p.price)}</span>
                    )}
                    {p.images_count ? <span className="ml-2 text-xs text-gray-400">• {p.images_count} fotos</span> : null}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5">
                    <Link to={`/admin/produtos/${p.id}/editar`} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"><Edit className="w-3 h-3" /> Editar</Link>
                    <button onClick={()=>handleDuplicate(p.id)} className="p-2 rounded-xl border hover:bg-gray-50" title="Duplicar"><Copy className="w-4 h-4 text-gray-600" /></button>
                    <button onClick={()=>handleDelete(p.id, p.name)} className="p-2 rounded-xl border hover:bg-red-50 text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={()=>fetchProducts(pagination.page - 1)}>Anterior</Button>
              <span className="text-sm text-gray-600">Página {pagination.page} de {pagination.pages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={()=>fetchProducts(pagination.page + 1)}>Próxima</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
