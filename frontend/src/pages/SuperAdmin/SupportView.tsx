import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getImageUrl } from '../../lib/api';
import { Card, Badge } from '../../components/ui/Button';
import { ArrowLeft, Shield, Eye, Package, Users } from 'lucide-react';

export default function SupportView() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.get(`/superadmin/stores/${id}/support-view`).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[id]);

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;
  if (!data?.store) return <div className="text-center py-12">Loja não encontrada</div>;

  return (
    <div className="space-y-6">
      <Link to={`/super-admin/lojas/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Modo Suporte — Acesso Registrado</p>
          <p>Esta visualização foi registrada nos logs de auditoria. Você está vendo dados da loja <strong>{data.store.name}</strong> para fins de suporte. Não faça alterações sem consentimento.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl" style={{ background: data.store.primary_color }}>{data.store.name[0]}</div>
        <div>
          <h1 className="font-display text-2xl font-bold">{data.store.name}</h1>
          <p className="text-sm text-gray-500">/{data.store.slug} • {data.store.status}</p>
        </div>
        <Badge variant={data.store.status === 'active' ? 'success' : 'danger'}>{data.store.status}</Badge>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Package className="w-6 h-6 text-sky-600 mx-auto" />
          <p className="text-2xl font-bold mt-2">{data.stats.products}</p>
          <p className="text-xs text-gray-500">Produtos</p>
        </Card>
        <Card className="p-4 text-center">
          <Users className="w-6 h-6 text-violet-600 mx-auto" />
          <p className="text-2xl font-bold mt-2">{data.admins?.length || 0}</p>
          <p className="text-xs text-gray-500">Administradores</p>
        </Card>
        <Card className="p-4 text-center">
          <Eye className="w-6 h-6 text-emerald-600 mx-auto" />
          <p className="text-sm font-medium mt-2 truncate">{data.store.whatsapp || 'Sem WhatsApp'}</p>
          <p className="text-xs text-gray-500">WhatsApp</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Administradores</h3>
          <div className="space-y-2">
            {data.admins.map((a:any)=>(
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border">
                <div><p className="font-medium text-sm">{a.name}</p><p className="text-xs text-gray-500">{a.email}</p></div>
                <span className="text-xs text-gray-400">{a.last_login_at ? new Date(a.last_login_at).toLocaleDateString('pt-BR') : 'Nunca acessou'}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Produtos Recentes</h3>
          <div className="space-y-2">
            {data.recentProducts?.map((p:any)=>(
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border">
                <span className="font-medium text-sm">{p.name}</span>
                <Badge variant={p.status === 'published' ? 'success' : 'warning'}>{p.status}</Badge>
              </div>
            ))}
          </div>
          <Link to={`/loja/${data.store.slug}`} target="_blank" className="mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium">
            <Eye className="w-4 h-4" /> Abrir Catálogo Público
          </Link>
        </Card>
      </div>
    </div>
  );
}
