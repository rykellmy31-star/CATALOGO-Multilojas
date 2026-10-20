import { useEffect, useState } from 'react';
import api from '../../lib/api';
import AdminImage from '../../components/AdminImage';
import { Card, Button, Input } from '../../components/ui/Button';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function Banners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', subtitle: '', image_url: '', button_text: '', link_url: '' });
  const fetch = async () => { try { const { data } = await api.get('/store/banners'); setBanners(data.banners || []); } catch {} };
  useEffect(()=>{fetch();},[]);
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image_url) return toast.error('Imagem obrigatória');
    try { await api.post('/store/banners', { ...form, position: 'hero' }); toast.success('Banner criado!'); setForm({ title:'', subtitle:'', image_url:'', button_text:'', link_url:'' }); fetch(); } catch { toast.error('Erro'); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir banner?')) return;
    try { await api.delete(`/store/banners/${id}`); toast.success('Removido'); fetch(); } catch { toast.error('Erro'); }
  };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try { const { data } = await api.post('/upload', fd, { headers: { 'Content-Type':'multipart/form-data' } }); setForm({...form, image_url: data.url}); toast.success('Imagem enviada!'); } catch { toast.error('Erro upload'); }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">Banners</h1>
        <p className="text-gray-500 mt-1">Gerencie o banner principal do seu catálogo</p>
      </div>
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Novo Banner</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Título" placeholder="Sofás com até 40% OFF" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} />
            <Input label="Subtítulo" placeholder="Aproveite nossa liquidação" value={form.subtitle} onChange={e=>setForm({...form, subtitle: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Imagem (1200x500 recomendado)</label>
            {form.image_url ? <div className="mt-2 relative"><AdminImage url={form.image_url} alt="" className="w-full h-32 object-cover rounded-xl border" /><button type="button" onClick={()=>setForm({...form, image_url:''})} className="absolute top-2 right-2 p-1 rounded-full bg-white shadow text-red-600">✕</button></div> : null}
            <div className="mt-2 flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed hover:bg-gray-50 cursor-pointer text-sm font-medium">
                <ImageIcon className="w-4 h-4" /> Enviar imagem
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              <input placeholder="Ou cole URL da imagem" value={form.image_url} onChange={e=>setForm({...form, image_url: e.target.value})} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Texto do botão" placeholder="Ver Ofertas" value={form.button_text} onChange={e=>setForm({...form, button_text: e.target.value})} />
            <Input label="Link" placeholder="/loja/sua-loja?filter=promo" value={form.link_url} onChange={e=>setForm({...form, link_url: e.target.value})} />
          </div>
          <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Criar Banner</Button>
        </form>
      </Card>
      <div className="grid gap-4">
        {banners.length === 0 ? <Card className="p-8 text-center"><ImageIcon className="w-8 h-8 text-gray-300 mx-auto" /><p className="text-sm text-gray-500 mt-2">Nenhum banner. Crie o primeiro!</p></Card> :
          banners.map(b=>(
            <Card key={b.id} className="overflow-hidden">
              <div className="relative h-40">
                <AdminImage url={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center p-6">
                  <div className="text-white">
                    <h3 className="font-bold text-lg">{b.title || 'Sem título'}</h3>
                    <p className="text-sm text-white/80">{b.subtitle}</p>
                  </div>
                </div>
                <button onClick={()=>handleDelete(b.id)} className="absolute top-3 right-3 p-2 rounded-xl bg-white text-red-600 hover:bg-red-50 shadow"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="p-3 flex items-center justify-between text-xs text-gray-500">
                <span>{b.position} • {b.is_active ? 'Ativo' : 'Inativo'}</span>
                <span>{b.button_text || 'Sem botão'} → {b.link_url || '-'}</span>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
