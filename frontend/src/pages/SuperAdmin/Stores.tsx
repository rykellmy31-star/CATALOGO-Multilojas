import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Card, Badge, Button, Input, Select } from '../../components/ui/Button';
import { Plus, Search, Eye, Edit, Trash2, PauseCircle, Store, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Stores() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', whatsapp: '', email: '', city: '', state: '' });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/superadmin/stores', { params: { q, status } });
      setStores(data.stores || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStores(); }, [q, status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error('Nome obrigatório');
    setSubmitting(true);
    try {
      await api.post('/superadmin/stores', form);
      toast.success('Loja criada com sucesso!');
      setShowForm(false);
      setForm({ name: '', slug: '', whatsapp: '', email: '', city: '', state: '' });
      fetchStores();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao criar loja'); } finally { setSubmitting(false); }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/loja/${slug}`);
    setCopied(slug);
    toast.success('Link copiado!');
    setTimeout(()=>setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Lojas</h1>
          <p className="text-gray-500 mt-1">{stores.length} lojas cadastradas • Gestão completa</p>
        </div>
        <Button onClick={()=>setShowForm(!showForm)}><Plus className="w-4 h-4 mr-2" /> Nova Loja</Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Cadastrar Nova Loja</h3>
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <Input label="Nome da Loja *" placeholder="Móveis Premium" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
            <Input label="Slug (URL)" placeholder="moveis-premium" value={form.slug} onChange={e=>setForm({...form, slug: e.target.value})} hint="Deixe vazio para gerar automaticamente" />
            <Input label="WhatsApp" placeholder="5573999999999" value={form.whatsapp} onChange={e=>setForm({...form, whatsapp: e.target.value})} hint="Somente números com DDD" />
            <Input label="Email" type="email" placeholder="contato@loja.com" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
            <Input label="Cidade" placeholder="Teixeira de Freitas" value={form.city} onChange={e=>setForm({...form, city: e.target.value})} />
            <Input label="Estado" placeholder="BA" value={form.state} onChange={e=>setForm({...form, state: e.target.value})} />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" loading={submitting}>Criar Loja</Button>
              <Button type="button" variant="outline" onClick={()=>setShowForm(false)}>Cancelar</Button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-3">Após criar, configure o administrador da loja em "Ver detalhes".</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Buscar por nome, slug ou email..." value={q} onChange={e=>setQ(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none" />
          </div>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-sky-500 outline-none">
            <option value="all">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="suspended">Suspensas</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i=><div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : stores.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="font-medium text-gray-900 mt-3">Nenhuma loja encontrada</p>
          <p className="text-sm text-gray-500 mt-1">Crie a primeira loja para começar.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map(store => (
            <Card key={store.id} hover className="p-6 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: store.primary_color || '#0ea5e9' }}>{store.name[0]}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">{store.name}</h3>
                    <p className="text-xs text-gray-500">/{store.slug}</p>
                  </div>
                </div>
                <Badge variant={store.status === 'active' ? 'success' : store.status === 'suspended' ? 'danger' : 'warning'}>{store.status}</Badge>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-500">Produtos</span><span className="font-semibold">{store.products_count || 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Admins</span><span className="font-semibold">{store.admins_count || 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Visitas</span><span className="font-semibold">{store.visits_count || 0}</span></div>
                {store.city && <p className="text-xs text-gray-400 pt-2">📍 {store.city}/{store.state}</p>}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button onClick={()=>copyLink(store.slug)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors">
                  {copied === store.slug ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} {copied === store.slug ? 'Copiado!' : 'Link'}
                </button>
                <a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border hover:bg-gray-50 text-gray-600">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <Link to={`/super-admin/lojas/${store.id}`} className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white">
                  <Eye className="w-4 h-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
