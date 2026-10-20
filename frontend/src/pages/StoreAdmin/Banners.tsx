import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import AdminImage from '../../components/AdminImage';
import { Card, Button, Input } from '../../components/ui/Button';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function Banners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', subtitle: '', image_url: '', button_text: '', link_url: '', starts_at: '', ends_at: '' });
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const createInFlight = useRef(false);
  const togglesInFlight = useRef(new Set<string>());
  const fetch = async () => { try { const { data } = await api.get('/store/banners'); setBanners(data.banners || []); } catch {} };
  useEffect(() => {
    fetch();
    return () => { uploadController.current?.abort(); };
  }, []);

  const cancelUpload = () => {
    uploadController.current?.abort();
    uploadController.current = null;
    setUploading(false);
  };
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createInFlight.current) return;
    if (uploading || uploadController.current) return toast.error('Aguarde o envio da imagem terminar');
    if (!form.image_url.trim()) return toast.error('Imagem obrigatória');
    // datetime-local usa o fuso horário do usuário; a API recebe ISO em UTC.
    const parseDateTime = (value: string): string | null => {
      if (!value) return null;
      const timestamp = new Date(value);
      if (!Number.isFinite(timestamp.getTime())) throw new Error('Data inválida');
      return timestamp.toISOString();
    };
    let startsAt: string | null;
    let endsAt: string | null;
    try {
      startsAt = parseDateTime(form.starts_at);
      endsAt = parseDateTime(form.ends_at);
    } catch {
      return toast.error('Informe datas válidas para a campanha');
    }
    if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
      return toast.error('O término deve ser posterior ao início');
    }
    createInFlight.current = true;
    setCreating(true);
    try {
      await api.post('/store/banners', {
        ...form, starts_at: startsAt, ends_at: endsAt, position: 'hero'
      });
      toast.success('Banner criado!');
      setForm({ title:'', subtitle:'', image_url:'', button_text:'', link_url:'', starts_at:'', ends_at:'' });
      await fetch();
    } catch (error: any) { toast.error(error?.response?.data?.error || 'Erro ao criar banner'); }
    finally {
      createInFlight.current = false;
      setCreating(false);
    }
  };
  const handleToggleActive = async (banner: any) => {
    if (togglesInFlight.current.has(banner.id)) return;
    togglesInFlight.current.add(banner.id);
    try {
      await api.put(`/store/banners/${banner.id}`, { is_active: !banner.is_active });
      toast.success(banner.is_active ? 'Banner desativado!' : 'Banner ativado!');
      await fetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Não foi possível alterar o banner');
    } finally {
      togglesInFlight.current.delete(banner.id);
    }
  };

  const displaySchedule = (value: string | null) => {
    if (!value) return 'Sem limite';
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('pt-BR') : value;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir banner?')) return;
    try { await api.delete(`/store/banners/${id}`); toast.success('Removido'); fetch(); } catch { toast.error('Erro'); }
  };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || createInFlight.current) return;
    cancelUpload();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      input.value = '';
      return toast.error('Use JPG, PNG, WEBP ou GIF');
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      input.value = '';
      return toast.error('Imagem vazia ou acima de 10 MB');
    }
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (typeof data?.url !== 'string' || !data.url) throw new Error('URL ausente');
      setForm(previous => ({ ...previous, image_url: data.url }));
      toast.success('Imagem enviada!');
    } catch {
      if (!controller.signal.aborted) toast.error('Erro no envio da imagem');
    } finally {
      if (uploadController.current === controller) {
        uploadController.current = null;
        setUploading(false);
      }
      input.value = '';
    }
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
            {form.image_url ? <div className="mt-2 relative"><AdminImage url={form.image_url} alt="Prévia do banner" className="w-full h-32 object-cover rounded-xl border" /><button type="button" disabled={creating} onClick={()=>{ cancelUpload(); setForm(previous => ({ ...previous, image_url:'' })); }} className="absolute top-2 right-2 p-1 rounded-full bg-white shadow text-red-600 disabled:opacity-50">✕</button></div> : null}
            <div className="mt-2 flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed hover:bg-gray-50 cursor-pointer text-sm font-medium">
                <ImageIcon className="w-4 h-4" /> Enviar imagem
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={creating} className="hidden" onChange={handleUpload} />
              </label>
              <input placeholder="Ou cole URL da imagem" value={form.image_url} disabled={creating} onChange={e=>{ cancelUpload(); setForm(previous => ({ ...previous, image_url: e.target.value })); }} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Texto do botão" placeholder="Ver Ofertas" value={form.button_text} onChange={e=>setForm({...form, button_text: e.target.value})} />
            <Input label="Link" placeholder="/loja/sua-loja?filter=promo" value={form.link_url} onChange={e=>setForm({...form, link_url: e.target.value})} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-gray-700">
              Início da exibição (opcional)
              <input type="datetime-local" value={form.starts_at} disabled={creating || uploading}
                onChange={e => setForm(previous => ({ ...previous, starts_at: e.target.value }))}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Término da exibição (opcional)
              <input type="datetime-local" value={form.ends_at} disabled={creating || uploading}
                min={form.starts_at || undefined}
                onChange={e => setForm(previous => ({ ...previous, ends_at: e.target.value }))}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200" />
            </label>
          </div>
          <p className="text-xs text-gray-500">As datas seguem o horário local do navegador e são salvas em UTC. Sem datas, o banner pode ser exibido continuamente.</p>
          <Button type="submit" disabled={uploading || creating}><Plus className="w-4 h-4 mr-2" /> {uploading ? 'Enviando imagem...' : creating ? 'Salvando...' : 'Criar Banner'}</Button>
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
                <div className="space-y-1">
                  <span>{b.position} • {b.is_active ? 'Habilitado' : 'Desabilitado'}</span>
                  <p>Início: {displaySchedule(b.starts_at)} • Fim: {displaySchedule(b.ends_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span>{b.button_text || 'Sem botão'} → {b.link_url || '-'}</span>
                  <button type="button" onClick={() => handleToggleActive(b)}
                    className="rounded-xl border px-3 py-1.5 hover:bg-gray-50">
                    {b.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
