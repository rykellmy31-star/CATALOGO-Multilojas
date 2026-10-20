import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { Card, Button, Input, Textarea } from '../../components/ui/Button';
import { Palette, Sparkles, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformConfig() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(()=>{
    api.get('/superadmin/platform-config').then(r=>setConfig(r.data.config || {})).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const handleSave = async () => {
    if (savingRef.current) return;
    const limits = [
      ['ai_daily_limit_default', 0, 10000],
      ['ai_monthly_limit_default', 0, 100000],
      ['storage_limit_per_store_mb', 1, 102400]
    ] as const;
    if (limits.some(([field, min, max]) => {
      const value = config[field];
      return value !== undefined && (!Number.isInteger(value) || value < min || value > max);
    })) {
      return toast.error('Verifique os limites de IA e armazenamento');
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data } = await api.put('/superadmin/platform-config', config);
      setConfig(data.config);
      toast.success('Configurações da plataforma salvas!');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2"><Palette className="w-7 h-7 text-sky-600" /> Identidade da Plataforma</h1>
        <p className="text-gray-500 mt-1">Personalize a aparência e limites globais da plataforma</p>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Palette className="w-5 h-5 text-violet-600" /> Visual</h3>
        <div className="space-y-4">
          <Input label="Nome da Plataforma" value={config.platform_name || ''} onChange={e=>setConfig({...config, platform_name: e.target.value})} />
          <Input label="Logo URL" value={config.logo_url || ''} onChange={e=>setConfig({...config, logo_url: e.target.value})} hint="URL da logo exibida no login" />
          <Textarea label="Texto do Rodapé (exibido nos catálogos públicos)" value={config.footer_text || ''} onChange={e=>setConfig({...config, footer_text: e.target.value})} rows={2} />
          <Input label="Email de Suporte" type="email" value={config.support_email || ''} onChange={e=>setConfig({...config, support_email: e.target.value})} />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Cor Primária</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={config.primary_color || '#0ea5e9'} onChange={e=>setConfig({...config, primary_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={config.primary_color || ''} onChange={e=>setConfig({...config, primary_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cor Secundária</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={config.secondary_color || '#0f172a'} onChange={e=>setConfig({...config, secondary_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={config.secondary_color || ''} onChange={e=>setConfig({...config, secondary_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cor Destaque</label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={config.accent_color || '#f59e0b'} onChange={e=>setConfig({...config, accent_color: e.target.value})} className="w-12 h-10 rounded-xl border" />
                <input value={config.accent_color || ''} onChange={e=>setConfig({...config, accent_color: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> Inteligência Artificial (Global)</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Provedor</label>
              <select value={config.ai_provider || 'openai'} onChange={e=>setConfig({...config, ai_provider: e.target.value})} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white">
                <option value="openai">OpenAI (GPT-4o + DALL·E)</option>
                <option value="anthropic">Anthropic (futuro)</option>
                <option value="google">Google (futuro)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={!!config.ai_enabled} onChange={e=>setConfig({...config, ai_enabled: e.target.checked ? 1 : 0})} className="rounded" /> IA Habilitada Globalmente
              </label>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Limite Diário Padrão (por loja)" type="number" value={config.ai_daily_limit_default ?? 10} onChange={e=>setConfig({...config, ai_daily_limit_default: e.target.value === '' ? '' : Number(e.target.value)})} />
            <Input label="Limite Mensal Padrão" type="number" value={config.ai_monthly_limit_default ?? 100} onChange={e=>setConfig({...config, ai_monthly_limit_default: e.target.value === '' ? '' : Number(e.target.value)})} />
            <Input label="Limite Armazenamento (MB por loja)" type="number" value={config.storage_limit_per_store_mb ?? 1024} onChange={e=>setConfig({...config, storage_limit_per_store_mb: e.target.value === '' ? '' : Number(e.target.value)})} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium flex items-center gap-2"><Shield className="w-4 h-4" /> Configuração da chave de IA</p>
            <p className="mt-1">A chave <code>OPENAI_API_KEY</code> deve ser configurada como <strong>secret</strong> via <code>wrangler secret put OPENAI_API_KEY</code>. Nunca coloque a chave no código ou no banco. Custo por geração é registrado em <code>ai_generations</code> para auditoria.</p>
            <p className="mt-2 text-xs">Limites por loja podem ser ajustados individualmente em cada loja. A IA pode ser desabilitada por loja mesmo se habilitada globalmente.</p>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} loading={saving} disabled={saving} size="lg" className="w-full">
        <Save className="w-4 h-4 mr-2" /> Salvar Configurações da Plataforma
      </Button>
    </div>
  );
}
