import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { getImageUrl } from '../../lib/api';
import { Card, Button, Input, Textarea, Select, Badge } from '../../components/ui/Button';
import { ArrowLeft, Upload, Sparkles, X, Save, Eye, Trash2, Wand2, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    name: '', sku: '', short_description: '', description: '', price: '', original_price: '', promotional_price: '',
    category_id: '', brand_id: '', status: 'draft', is_featured: false, is_on_sale: false, stock_quantity: 0, dimensions: '', technical_specs: ''
  });
  const [images, setImages] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // IA state
  const [showAI, setShowAI] = useState(false);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiStyle, setAiStyle] = useState('modern_room');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    api.get('/store/categories').then(r=>setCategories(r.data.categories || [])).catch(()=>{});
    api.get('/store/brands').then(r=>setBrands(r.data.brands || [])).catch(()=>{});
    if (isEdit) {
      api.get(`/store/products/${id}`).then(r=>{
        const p = r.data.product;
        setForm({
          name: p.name || '', sku: p.sku || '', short_description: p.short_description || '', description: p.description || '',
          price: p.price ?? '', original_price: p.original_price || '', promotional_price: p.promotional_price || '',
          category_id: p.category_id || '', brand_id: p.brand_id || '', status: p.status || 'draft',
          is_featured: !!p.is_featured, is_on_sale: !!p.is_on_sale, stock_quantity: p.stock_quantity || 0,
          dimensions: p.dimensions || '', technical_specs: p.technical_specs || ''
        });
        setExistingImages(r.data.images || []);
      }).catch(()=>toast.error('Erro ao carregar produto'));
    }
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setImages(prev => [...prev, data.url]);
        if (!aiImage) setAiImage(data.url);
      }
      toast.success('Imagens enviadas!');
    } catch { toast.error('Erro ao enviar imagem'); } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price === '' || form.price == null) return toast.error('Nome e preço são obrigatórios');
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price) || 0,
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        promotional_price: form.promotional_price ? parseFloat(form.promotional_price) : null,
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        images: [...existingImages.map(image => image.url), ...images]
      };
      if (isEdit) {
        await api.put(`/store/products/${id}`, payload);
        toast.success('Produto atualizado!');
      } else {
        const { data } = await api.post('/store/products', payload);
        toast.success('Produto criado!');
        navigate(`/admin/produtos/${data.product.id}/editar`);
        return;
      }
      // Refresh images if edit
      if (isEdit) {
        const { data } = await api.get(`/store/products/${id}`);
        setExistingImages(data.images || []);
        setImages([]);
      }
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao salvar'); } finally { setLoading(false); }
  };

  const handleGenerateAI = async () => {
    if (!aiImage) return toast.error('Envie uma imagem primeiro');
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const { data } = await api.post('/store/ai/generate', { image_url: aiImage, style: aiStyle, product_id: id || undefined });
      setAiResult(data.generation);
      toast.success('Geração concluída! Revise os dados.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Erro ao gerar';
      setAiError(msg);
      if (err.response?.status === 503) {
        toast.error('IA não configurada. Configure a chave OpenAI.');
      } else {
        toast.error(msg);
      }
    } finally { setAiLoading(false); }
  };

  const applyAIResult = () => {
    if (!aiResult) return;
    setForm((prev:any) => ({
      ...prev,
      name: aiResult.name || prev.name,
      short_description: aiResult.shortDescription || prev.short_description,
      description: aiResult.description || prev.description,
    }));
    if (aiResult.imageUrl) {
      setImages(prev => [...prev, aiResult.imageUrl]);
    }
    toast.success('Informações da IA aplicadas!');
    setShowAI(false);
  };

  const removeImage = (idx: number, isExisting=false) => {
    if (isExisting) setExistingImages(prev => prev.filter((_,i)=>i!==idx));
    else setImages(prev => prev.filter((_,i)=>i!==idx));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/admin/produtos" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Voltar para produtos
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{isEdit ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isEdit ? 'Atualize as informações do produto' : 'Cadastre um novo produto no catálogo'}</p>
        </div>
        {isEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={()=>setPreviewOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 text-sm font-medium">
              <Eye className="w-4 h-4" /> Pré-visualizar
            </button>
          </div>
        )}
      </div>

      {previewOpen && <div role="dialog" aria-modal="true" aria-label="Prévia do produto" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setPreviewOpen(false)}><div className="max-w-lg w-full bg-white p-6 rounded-2xl" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setPreviewOpen(false)} className="float-right" aria-label="Fechar prévia">✕</button><img src={getImageUrl(existingImages[0]?.url || images[0])} alt={form.name} className="w-full h-64 object-contain"/><h2 className="text-2xl font-bold mt-4">{form.name}</h2><p className="text-xl mt-2">{Number(form.price || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p><p className="mt-4 whitespace-pre-line">{form.description}</p></div></div>}
      {/* IA Banner */}
      <Card className="p-0 overflow-hidden border-sky-200">
        <div className="bg-gradient-to-r from-sky-600 via-violet-600 to-indigo-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">IA para Anúncios Profissionais</h3>
              <p className="text-xs text-sky-100">Transforme fotos simples em anúncios que vendem</p>
            </div>
          </div>
          <Button variant="outline" onClick={()=>setShowAI(!showAI)} className="bg-white text-sky-700 hover:bg-sky-50 border-0">
            <Wand2 className="w-4 h-4 mr-2" /> {showAI ? 'Fechar IA' : 'Gerar com IA'}
          </Button>
        </div>

        {showAI && (
          <div className="p-6 space-y-4 bg-sky-50/50">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700">Imagem do produto para análise *</label>
                <div className="mt-2">
                  {aiImage ? (
                    <div className="relative">
                      <img src={aiImage} alt="Para IA" className="w-full h-48 object-cover rounded-xl border" />
                      <button onClick={()=>setAiImage(null)} className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow text-red-600 hover:bg-red-50">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-sky-200 bg-white hover:bg-sky-50 cursor-pointer transition-colors">
                      <Upload className="w-8 h-8 text-sky-400" />
                      <span className="text-sm font-medium text-gray-700 mt-2">Enviar foto</span>
                      <span className="text-xs text-gray-500">O sistema analisará automaticamente</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e)=>{
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setAiImage(reader.result as string);
                        reader.readAsDataURL(file);
                        // Também upload para storage
                        const fd = new FormData();
                        fd.append('file', file);
                        api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r=>setAiImage(r.data.url)).catch(()=>{});
                      }} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">A IA preserva cores e modelo reais. Exibirá custo estimado.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Estilo da imagem publicitária</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { id: 'modern_room', label: 'Ambiente Moderno', icon: '🏠' },
                      { id: 'white_background', label: 'Fundo Branco', icon: '⬜' },
                      { id: 'promotional', label: 'Promocional', icon: '🎉' },
                      { id: 'premium_catalog', label: 'Catálogo Premium', icon: '✨' },
                    ].map(s => (
                      <button key={s.id} onClick={()=>setAiStyle(s.id)} className={`p-3 rounded-xl border text-left transition-all ${aiStyle === s.id ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="text-lg">{s.icon}</span>
                        <p className="text-xs font-medium mt-1">{s.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-3 text-xs">
                  <p className="font-medium text-gray-700">💰 Custo estimado</p>
                  <p className="text-gray-500 mt-1">Descrição: ~$0.01 • Imagem: ~$0.04 • <span className="font-semibold text-gray-700">Total: ~$0.05 por produto</span></p>
                  <p className="text-gray-400 mt-1">Limite da sua loja: ver painel Super Admin</p>
                </div>

                <Button onClick={handleGenerateAI} loading={aiLoading} disabled={!aiImage} className="w-full" size="lg">
                  <Sparkles className="w-4 h-4 mr-2" /> Gerar Nome, Descrição e Imagem
                </Button>

                {aiError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{aiError}</p>
                  </div>
                )}

                {aiResult && (
                  <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                      <Check className="w-4 h-4" /> Geração concluída!
                    </div>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Nome:</span> {aiResult.name}</div>
                      <div><span className="font-medium">Descrição curta:</span> {aiResult.shortDescription}</div>
                      <div className="text-xs text-gray-600 line-clamp-3"><span className="font-medium">Descrição:</span> {aiResult.description}</div>
                      {aiResult.category && <div><span className="font-medium">Categoria sugerida:</span> <Badge>{aiResult.category}</Badge></div>}
                      {aiResult.imageUrl && <img src={aiResult.imageUrl} alt="Gerada IA" className="w-full h-32 object-cover rounded-lg border" />}
                      {aiResult.imageUrl && <p className="text-xs text-gray-500">🖼️ Imagem ilustrativa — original preservada</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={applyAIResult} size="sm" className="flex-1"><Check className="w-4 h-4 mr-1" /> Aplicar no Produto</Button>
                      <Button variant="outline" size="sm" onClick={handleGenerateAI}>Gerar Novamente</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informações Básicas</h3>
            <div className="space-y-4">
              <Input label="Nome do Produto *" placeholder="Ex: Sofá Retrátil 2,30m Premium" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="SKU / Código" placeholder="SOF-RETR-001" value={form.sku} onChange={e=>setForm({...form, sku: e.target.value})} hint="Deixe vazio para gerar automaticamente" />
                <Select label="Status" value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="out_of_stock">Sem estoque</option>
                  <option value="archived">Arquivado</option>
                </Select>
              </div>
              <Textarea label="Descrição Curta" placeholder="Frase curta para cards e listagens" rows={2} value={form.short_description} onChange={e=>setForm({...form, short_description: e.target.value})} />
              <Textarea label="Descrição Completa" placeholder="Descrição persuasiva com benefícios, materiais, dimensões..." rows={5} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Preços</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <Input label="Preço *" type="number" step="0.01" placeholder="2899.00" value={form.price} onChange={e=>setForm({...form, price: e.target.value})} required />
              <Input label="Preço Original" type="number" step="0.01" placeholder="3899.00" value={form.original_price} onChange={e=>setForm({...form, original_price: e.target.value})} hint="Para mostrar desconto" />
              <Input label="Preço Promocional" type="number" step="0.01" placeholder="2599.00" value={form.promotional_price} onChange={e=>setForm({...form, promotional_price: e.target.value})} hint="Se houver oferta" />
            </div>
            <div className="flex gap-4 mt-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form, is_featured: e.target.checked})} className="rounded" /> Destaque na home</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_on_sale} onChange={e=>setForm({...form, is_on_sale: e.target.checked})} className="rounded" /> Em promoção</label>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Detalhes Técnicos</h3>
            <div className="space-y-4">
              <Input label="Dimensões" placeholder='Ex: 230x95x100 cm' value={form.dimensions} onChange={e=>setForm({...form, dimensions: e.target.value})} hint='Largura x Altura x Profundidade' />
              <Textarea label="Características Técnicas" placeholder="Material, peso, garantia, etc." rows={3} value={form.technical_specs} onChange={e=>setForm({...form, technical_specs: e.target.value})} />
              <Input label="Estoque" type="number" value={form.stock_quantity} onChange={e=>setForm({...form, stock_quantity: parseInt(e.target.value)||0})} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Organização</h3>
            <div className="space-y-4">
              <Select label="Categoria" value={form.category_id} onChange={e=>setForm({...form, category_id: e.target.value})}>
                <option value="">Selecione uma categoria</option>
                {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Marca" value={form.brand_id} onChange={e=>setForm({...form, brand_id: e.target.value})}>
                <option value="">Selecione uma marca</option>
                {brands.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Imagens</h3>
              <span className="text-xs text-gray-500">{existingImages.length + images.length} fotos</span>
            </div>

            {/* Existing images */}
            {existingImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {existingImages.map((img, idx)=>(
                  <div key={img.id} className="relative group">
                    <img src={getImageUrl(img.url)} alt="" className="w-full h-20 object-cover rounded-xl border" />
                    {img.is_primary ? <span className="absolute top-1 left-1 bg-sky-600 text-white text-xs px-1.5 py-0.5 rounded-full">Principal</span> : null}
                    {img.is_ai_generated ? <span className="absolute bottom-1 left-1 bg-violet-600 text-white text-xs px-1 py-0.5 rounded-full">IA</span> : null}
                    <button type="button" onClick={()=>removeImage(idx, true)} className="absolute top-1 right-1 p-1 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New images */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {images.map((url, idx)=>(
                  <div key={idx} className="relative group">
                    <img src={url} alt="" className="w-full h-20 object-cover rounded-xl border" />
                    <button type="button" onClick={()=>removeImage(idx, false)} className="absolute top-1 right-1 p-1 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                    {idx === 0 && existingImages.length === 0 ? <span className="absolute bottom-1 left-1 bg-sky-600 text-white text-xs px-1.5 py-0.5 rounded-full">Principal</span> : null}
                  </div>
                ))}
              </div>
            )}

            <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50 cursor-pointer transition-colors">
              {uploading ? <span className="text-sm text-gray-500">Enviando...</span> : <><Upload className="w-6 h-6 text-gray-400" /><span className="text-sm font-medium text-gray-600 mt-1">Enviar imagens</span><span className="text-xs text-gray-400">JPG, PNG, WEBP até 10MB</span></>}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
            <p className="text-xs text-gray-500 mt-2">A primeira imagem será a capa. Arraste para reordenar (em breve).</p>
          </Card>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            <Save className="w-4 h-4 mr-2" /> {isEdit ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>

          {isEdit && (
            <Button type="button" variant="outline" className="w-full" onClick={()=>{
              if (confirm('Excluir este produto?')) {
                api.delete(`/store/products/${id}`).then(()=>{toast.success('Produto excluído'); navigate('/admin/produtos');}).catch(()=>toast.error('Erro'));
              }
            }}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir Produto
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
