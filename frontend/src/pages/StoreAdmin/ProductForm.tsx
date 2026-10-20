import { useEffect, useRef, useState } from 'react';
import { parseProductAmount } from '../../lib/productFormSafety';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import AdminImage from '../../components/AdminImage';
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
  const [loadedProductId, setLoadedProductId] = useState<string | null>(null);
  const productPending = isEdit && loadedProductId !== id;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Refs impedem operações duplicadas mesmo antes da atualização visual do React.
  const savingRef = useRef(false);
  const galleryUploadingRef = useRef(false);
  const galleryControllerRef = useRef<AbortController | null>(null);
  const aiGeneratingRef = useRef(false);
  const aiRequestEpochRef = useRef(0);
  const aiIdempotencyRef = useRef<{ signature: string; requestId: string } | null>(null);
  const applyingAIRef = useRef(false);
  const aiUploadRef = useRef<{ sequence: number; pending: boolean; controller: AbortController | null }>({
    sequence: 0, pending: false, controller: null
  });
  const [aiUploading, setAiUploading] = useState(false);

  useEffect(() => () => {
    galleryControllerRef.current?.abort();
    aiUploadRef.current.sequence++;
    aiUploadRef.current.controller?.abort();
    aiUploadRef.current.pending = false;
  }, []);
  
  // IA state
  const [showAI, setShowAI] = useState(false);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiStyle, setAiStyle] = useState('modern_room');
  const [aiLoading, setAiLoading] = useState(false);
  const [applyingAI, setApplyingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    // Troca de produto invalida requisições pendentes e resultados da IA anterior.
    aiRequestEpochRef.current++;
    aiIdempotencyRef.current = null;
    galleryControllerRef.current?.abort();
    galleryControllerRef.current = null;
    galleryUploadingRef.current = false;
    const aiUpload = aiUploadRef.current;
    aiUpload.sequence++;
    aiUpload.controller?.abort();
    aiUpload.controller = null;
    aiUpload.pending = false;
    setUploading(false);
    setAiUploading(false);
    setLoadedProductId(null);
    setImages([]);
    setExistingImages([]);
    setAiImage(null);
    setAiResult(null);
    setAiError('');
    setForm({
      name: '', sku: '', short_description: '', description: '', price: '',
      original_price: '', promotional_price: '', category_id: '', brand_id: '',
      status: 'draft', is_featured: false, is_on_sale: false,
      stock_quantity: 0, dimensions: '', technical_specs: ''
    });
    api.get('/store/categories', { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setCategories(r.data.categories || []); })
      .catch(() => {});
    api.get('/store/brands', { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setBrands(r.data.brands || []); })
      .catch(() => {});
    if (id) {
      api.get(`/store/products/${id}`, { signal: controller.signal })
        .then(r => {
          if (controller.signal.aborted) return;
          const p = r.data.product;
          if (!p) throw new Error('Produto não encontrado');
          setForm({
            name: p.name || '', sku: p.sku || '', short_description: p.short_description || '',
            description: p.description || '', price: p.price ?? '',
            original_price: p.original_price ?? '', promotional_price: p.promotional_price ?? '',
            category_id: p.category_id || '', brand_id: p.brand_id || '', status: p.status || 'draft',
            is_featured: !!p.is_featured, is_on_sale: !!p.is_on_sale,
            stock_quantity: p.stock_quantity || 0, dimensions: p.dimensions || '',
            technical_specs: p.technical_specs || ''
          });
          setExistingImages(r.data.images || []);
          setLoadedProductId(id);
        })
        .catch(() => { if (!controller.signal.aborted) toast.error('Erro ao carregar produto'); });
    }
    return () => controller.abort();
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const selected = Array.from(input.files || []);
    input.value = '';
    if (!selected.length) return;
    if (savingRef.current || galleryUploadingRef.current) {
      return toast.error('Aguarde a operação anterior terminar');
    }
    for (const file of selected) {
      if (!['image/jpeg','image/jpg','image/png','image/webp','image/gif'].includes(file.type) ||
          file.size > 10 * 1024 * 1024) {
        return toast.error('Use imagens JPG, PNG, WEBP ou GIF de até 10 MB');
      }
    }
    const controller = new AbortController();
    galleryUploadingRef.current = true;
    galleryControllerRef.current = controller;
    setUploading(true);
    try {
      for (const file of selected) {
        const fd = new FormData();
        fd.append('file', file);
        const { data } = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal
        });
        if (controller.signal.aborted) return;
        if (typeof data?.url !== 'string' || !data.url.trim()) throw new Error('Imagem sem URL');
        setImages(prev => prev.includes(data.url) ? prev : [...prev, data.url]);
        setAiImage(prev => prev || data.url);
      }
      toast.success('Imagens enviadas!');
    } catch {
      if (!controller.signal.aborted) toast.error('Erro ao enviar imagem');
    } finally {
      if (galleryControllerRef.current === controller) {
        galleryUploadingRef.current = false;
        galleryControllerRef.current = null;
        setUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (productPending) return toast.error('Aguarde carregar os dados do produto');
    if (galleryUploadingRef.current || aiUploadRef.current.pending || aiGeneratingRef.current || applyingAIRef.current) {
      return toast.error('Aguarde os uploads e a IA terminarem antes de salvar');
    }
    if (!form.name || form.price === '' || form.price == null) return toast.error('Nome e preço são obrigatórios');
    let price: number, originalPrice: number | null, promotionalPrice: number | null;
    try {
      price = parseProductAmount(form.price) as number;
      originalPrice = parseProductAmount(form.original_price, true);
      promotionalPrice = parseProductAmount(form.promotional_price, true);
    } catch {
      return toast.error('Confira os preços: informe valores válidos e não negativos');
    }
    savingRef.current = true;
    setLoading(true);
    try {
      const payload = {
        ...form,
        price,
        original_price: originalPrice,
        promotional_price: promotionalPrice,
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
      // Uma falha do GET posterior não significa que o salvamento falhou.
      if (isEdit) {
        try {
          const { data } = await api.get(`/store/products/${id}`);
          setExistingImages(data.images || []);
          setImages([]);
        } catch {
          toast.warning('Produto salvo, mas não foi possível atualizar as fotos na tela');
        }
      }
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao salvar'); }
    finally { savingRef.current = false; setLoading(false); }
  };

  const handleAIImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (savingRef.current || aiGeneratingRef.current || applyingAIRef.current) {
      return toast.error('Aguarde a operação atual terminar');
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024) {
      return toast.error('A IA aceita fotos JPG, PNG ou WEBP com até 10 MB');
    }
    const upload = aiUploadRef.current;
    upload.sequence++;
    upload.controller?.abort();
    const sequence = upload.sequence;
    const controller = new AbortController();
    upload.controller = controller;
    upload.pending = true;
    setAiUploading(true);
    setAiImage(null);
    setAiResult(null);
    setAiError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal
      });
      if (sequence !== upload.sequence || controller.signal.aborted) return;
      if (typeof data?.url !== 'string' || !data.url.startsWith('/api/storage/')) {
        throw new Error('URL de imagem ausente');
      }
      setAiImage(data.url);
    } catch {
      if (sequence === upload.sequence && !controller.signal.aborted) {
        setAiError('Não foi possível enviar a foto para IA');
        toast.error('Erro ao enviar foto para IA');
      }
    } finally {
      if (sequence === upload.sequence) {
        upload.pending = false;
        upload.controller = null;
        setAiUploading(false);
      }
    }
  };

  const removeAIImage = () => {
    if (aiGeneratingRef.current || savingRef.current) return;
    const upload = aiUploadRef.current;
    upload.sequence++;
    upload.controller?.abort();
    upload.controller = null;
    upload.pending = false;
    setAiUploading(false);
    setAiImage(null);
    setAiResult(null);
    setAiError('');
  };

  const handleGenerateAI = async () => {
    if (productPending) return toast.error('Aguarde carregar o produto');
    if (savingRef.current || galleryUploadingRef.current || aiUploadRef.current.pending) {
      return toast.error('Aguarde o envio e o salvamento das imagens terminar');
    }
    if (!aiImage) return toast.error('Envie uma imagem primeiro');
    if (aiGeneratingRef.current) return;
    aiGeneratingRef.current = true;
    const epoch = aiRequestEpochRef.current;
    // Reaproveita a chave após perda de conexão; não repete a operação no servidor.
    const signature = JSON.stringify([id || null, aiImage, aiStyle, true, true]);
    if (aiIdempotencyRef.current?.signature !== signature) {
      aiIdempotencyRef.current = { signature, requestId: crypto.randomUUID() };
    }
    const requestId = aiIdempotencyRef.current.requestId;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const { data } = await api.post('/store/ai/generate', {
        image_url: aiImage, style: aiStyle, product_id: id || undefined,
        request_id: requestId
      });
      if (epoch !== aiRequestEpochRef.current) return;
      aiIdempotencyRef.current = null;
      setAiResult(data.generation);
      if (data.generation?.imageError) {
        setAiError(data.generation.imageError);
        toast.warning('Descrição gerada, mas a imagem não pôde ser concluída');
      } else {
        toast.success('Geração concluída! Revise os dados.');
      }
    } catch (err: any) {
      if (epoch !== aiRequestEpochRef.current) return;
      const status = err.response?.status;
      const msg = status === 409
        ? 'Esta solicitação já foi recebida. Confira o histórico da IA antes de tentar outra.'
        : err.response?.data?.message || err.response?.data?.error || 'Não foi possível confirmar a geração. Confira o histórico da IA.';
      // Apenas erros de validação/limite, anteriores à geração, permitem nova chave.
      if ([400, 403, 404, 413, 422, 429].includes(status)) {
        aiIdempotencyRef.current = null;
      }
      setAiError(msg);
      if (status === 503) {
        toast.error('IA não configurada. Configure a chave OpenAI.');
      } else {
        toast.error(msg);
      }
    } finally {
      aiGeneratingRef.current = false;
      setAiLoading(false);
    }
  };

  const applyAIResult = async () => {
    if (!aiResult || applyingAIRef.current || savingRef.current || aiGeneratingRef.current) return;
    applyingAIRef.current = true;
    setApplyingAI(true);
    try {
      if (aiResult.imageUrl) {
        if (isEdit && id && aiResult.id) {
          // Só imagens de gerações verificadas podem receber a marcação de IA.
          await api.post('/store/ai/approve-image', {
            product_id: id, image_url: aiResult.imageUrl, generation_id: aiResult.id
          });
          const { data } = await api.get(`/store/products/${id}`);
          setExistingImages(data.images || []);
        } else {
          // No primeiro cadastro, a URL privada só será publicada ao salvar o produto.
          setImages(prev => [...new Set([...prev, aiResult.imageUrl])]);
        }
      }
      setForm((prev:any) => ({
        ...prev,
        name: aiResult.name || prev.name,
        short_description: aiResult.shortDescription || prev.short_description,
        description: aiResult.description || prev.description,
      }));
      toast.success('Informações da IA aplicadas!');
      setShowAI(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Não foi possível aprovar a imagem de IA');
    } finally {
      applyingAIRef.current = false;
      setApplyingAI(false);
    }
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

      {previewOpen && <div role="dialog" aria-modal="true" aria-label="Prévia do produto" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setPreviewOpen(false)}><div className="max-w-lg w-full bg-white p-6 rounded-2xl" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setPreviewOpen(false)} className="float-right" aria-label="Fechar prévia">✕</button><AdminImage url={existingImages[0]?.url || images[0]} alt={form.name} className="w-full h-64 object-contain"/><h2 className="text-2xl font-bold mt-4">{form.name}</h2><p className="text-xl mt-2">{Number(form.price || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p><p className="mt-4 whitespace-pre-line">{form.description}</p></div></div>}
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
                  {aiImage && !aiUploading ? (
                    <div className="relative">
                      <AdminImage url={aiImage} alt="Para IA" className="w-full h-48 object-cover rounded-xl border" />
                      <button type="button" disabled={aiLoading || loading} onClick={removeAIImage} aria-label="Remover foto para IA" className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow text-red-600 hover:bg-red-50 disabled:opacity-50">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-sky-200 bg-white hover:bg-sky-50 cursor-pointer transition-colors">
                      <Upload className="w-8 h-8 text-sky-400" />
                      <span className="text-sm font-medium text-gray-700 mt-2">{aiUploading ? 'Enviando foto...' : 'Enviar foto'}</span>
                      <span className="text-xs text-gray-500">{aiUploading ? 'Aguarde o envio terminar' : 'A foto será enviada para sua loja antes da geração'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={aiLoading || loading} onChange={handleAIImageUpload} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">A IA usa a imagem original como referência; revise o resultado antes de publicar. A edição tem custo variável.</p>
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
                  <p className="font-medium text-gray-700">Uso da IA e cobrança</p>
                  <p className="text-gray-500 mt-1">A geração utiliza uma API paga quando acionada. O custo varia conforme o modelo, a imagem e o uso; nenhum valor fixo é garantido.</p>
                  <p className="text-gray-400 mt-1">Consulte limites da sua loja e custos do provedor antes de gerar.</p>
                </div>

                <Button onClick={handleGenerateAI} loading={aiLoading} disabled={!aiImage || aiLoading || aiUploading || uploading || loading || applyingAI} className="w-full" size="lg">
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
                      {aiResult.imageUrl && <AdminImage url={aiResult.imageUrl} alt="Gerada IA" className="w-full h-32 object-cover rounded-lg border" />}
                      {aiResult.imageUrl && <p className="text-xs text-gray-500">🖼️ Imagem ilustrativa — original preservada</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={applyAIResult} loading={applyingAI} disabled={applyingAI} size="sm" className="flex-1"><Check className="w-4 h-4 mr-1" /> Aplicar no Produto</Button>
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
                <Input label="SKU / Código" placeholder="SOF-RETR-001" value={form.sku} onChange={e=>setForm({...form, sku: e.target.value})} hint="Opcional: use um código interno" />
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
                    <AdminImage url={img.url} alt="" className="w-full h-20 object-cover rounded-xl border" />
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
                    <AdminImage url={url} alt="" className="w-full h-20 object-cover rounded-xl border" />
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
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleImageUpload} disabled={uploading || loading} />
            </label>
            <p className="text-xs text-gray-500 mt-2">A primeira imagem será a capa. Salve para aplicar as alterações.</p>
          </Card>

          <Button type="submit" loading={loading} disabled={productPending || loading || uploading || aiUploading || aiLoading || applyingAI} className="w-full" size="lg">
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
