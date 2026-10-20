import { useEffect, useRef, useState } from 'react';
import api, { getImageUrl } from '../../lib/api';
import { Card, Button, Input, Textarea } from '../../components/ui/Button';
import { Save, Upload, ExternalLink, Palette } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [store, setStore] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const savingRef = useRef(false);
  const uploadingLogoRef = useRef(false);

  useEffect(()=>{
    api.get('/store/settings').then(r=>setStore(r.data.store)).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const handleSave = async () => {
    if (savingRef.current) return;
    if (uploadingLogoRef.current) {
      toast.error('Aguarde o envio da logomarca terminar.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const submittedStore = { ...store };
    try {
      const { data } = await api.put('/store/settings', submittedStore);
      // Uma resposta antiga não pode apagar alterações feitas enquanto salvava.
      setStore(current => Object.keys(submittedStore).some(key => current[key] !== submittedStore[key])
        ? current : data.store);
      toast.success('Configurações salvas!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file || uploadingLogoRef.current || savingRef.current) return;
    const input = e.currentTarget;
    const previousLogoUrl = store.logo_url;
    uploadingLogoRef.current = true;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!data?.url || typeof data.url !== 'string') throw new Error('URL da imagem ausente');
      // Preserva edições feitas durante o upload, inclusive uma URL colada manualmente.
      setStore(current => current.logo_url === previousLogoUrl
        ? { ...current, logo_url: data.url } : current);
      toast.success('Logo enviada! Clique em Salvar.');
    } catch {
      toast.error('Erro ao enviar a logomarca');
    } finally {
      uploadingLogoRef.current = false;
      setUploadingLogo(false);
      input.value = '';
    }
  };

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 mt-1">Personalize sua loja e informações de contato</p>
        </div>
        <a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 text-sm font-medium">
          <ExternalLink className="w-4 h-4" /> Ver Catálogo
        </a>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Palette className="w-5 h-5 text-sky-600" /> Identidade Visual</h3>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Nome da Loja" value={store.name || ''} onChange={e=>setStore({...store, name: e.target.value})} />
            <Input label="Slug (URL)" value={store.slug || ''} onChange={e=>setStore({...store, slug: e.target.value})} hint={`${window.location.origin}/loja/${store.slug || 'sua-loja'}`} />
          </div>
          <Textarea label="Descrição" placeholder="Descrição curta da loja" rows={2} value={store.description || ''} onChange={e=>setStore({...store, description: e.target.value})} />
          
          <div>
            <label className="text-sm font-medium text-gray-700">Logomarca</label>
            <div className="mt-2 flex items-center gap-4">
              {store.logo_url ? <img src={getImageUrl(store.logo_url)} alt="Logo" className="w-20 h-20 rounded-xl border object-contain bg-white" /> : <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-gray-400">Logo</div>}
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 cursor-pointer text-sm font-medium">
                <Upload className="w-4 h-4" /> Enviar Logo
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo || saving} onChange={handleLogoUpload} />
              </label>
              <input placeholder="Ou cole URL" value={store.logo_url || ''} onChange={e=>setStore({...store, logo_url: e.target.value})} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Cor Primária</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={store.primary_color || '#0ea5e9'} onChange={e=>setStore({...store, primary_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={store.primary_color || ''} onChange={e=>setStore({...store, primary_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-gray-200" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Cor Secundária</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={store.secondary_color || '#0f172a'} onChange={e=>setStore({...store, secondary_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={store.secondary_color || ''} onChange={e=>setStore({...store, secondary_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-gray-200" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Cor de Destaque</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={store.accent_color || '#f59e0b'} onChange={e=>setStore({...store, accent_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={store.accent_color || ''} onChange={e=>setStore({...store, accent_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-gray-200" />
              </div>
            </div>
          </div>
          {/* Preview */}
          <div className="rounded-xl border p-4 flex items-center gap-3" style={{ background: `${store.primary_color}10` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: store.primary_color || '#0ea5e9' }}>{store.name?.[0] || 'L'}</div>
            <div>
              <p className="font-semibold" style={{ color: store.primary_color || '#0ea5e9' }}>{store.name || 'Nome da Loja'}</p>
              <p className="text-xs text-gray-500">Prévia de como aparecerá no catálogo</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Contato e Endereço</h3>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="WhatsApp" placeholder="5573999999999" value={store.whatsapp || ''} onChange={e=>setStore({...store, whatsapp: e.target.value})} hint="Número com DDD para botão de contato" />
            <Input label="Telefone" placeholder="(73) 99999-9999" value={store.phone || ''} onChange={e=>setStore({...store, phone: e.target.value})} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Email" type="email" value={store.email || ''} onChange={e=>setStore({...store, email: e.target.value})} />
            <Input label="Instagram" placeholder="@sualoja" value={store.instagram || ''} onChange={e=>setStore({...store, instagram: e.target.value})} />
          </div>
          <Input label="Facebook" value={store.facebook || ''} onChange={e=>setStore({...store, facebook: e.target.value})} />
          <Input label="Endereço" placeholder="Av. Brasil, 1500 - Centro" value={store.address || ''} onChange={e=>setStore({...store, address: e.target.value})} />
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Cidade" value={store.city || ''} onChange={e=>setStore({...store, city: e.target.value})} />
            <Input label="Estado" value={store.state || ''} onChange={e=>setStore({...store, state: e.target.value})} />
            <Input label="CEP" value={store.zip_code || ''} onChange={e=>setStore({...store, zip_code: e.target.value})} />
          </div>
          <Textarea label="Horário de Funcionamento" value={store.opening_hours || ''} onChange={e=>setStore({...store, opening_hours: e.target.value})} placeholder="Segunda a Sexta: 08h às 18h | Sábado: 08h às 13h" rows={2} />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">SEO</h3>
        <div className="space-y-4">
          <Input label="Título SEO" value={store.seo_title || ''} onChange={e=>setStore({...store, seo_title: e.target.value})} />
          <Textarea label="Descrição SEO" rows={2} value={store.seo_description || ''} onChange={e=>setStore({...store, seo_description: e.target.value})} />
          <Input label="Palavras-chave" placeholder="móveis, sofá, decoração..." value={store.seo_keywords || ''} onChange={e=>setStore({...store, seo_keywords: e.target.value})} />
        </div>
      </Card>

      <Button onClick={handleSave} loading={saving} disabled={uploadingLogo} size="lg" className="w-full">
        <Save className="w-4 h-4 mr-2" /> Salvar Todas as Configurações
      </Button>
    </div>
  );
}
