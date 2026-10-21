import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatPrice } from '../../lib/api';
import { Card, Badge } from '../../components/ui/Button';
import { Store, Package, Eye, Sparkles, DollarSign, TrendingUp, Plus, ArrowUpRight, Activity } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/superadmin/dashboard').then(r => setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-100 rounded-2xl" /><div className="h-64 bg-gray-100 rounded-2xl" /></div>;

  const stats = data?.stats || {};

  const cards = [
    { label: 'Total de Lojas', value: stats.totalStores || 0, icon: Store, color: 'bg-sky-600', sub: `${stats.activeStores || 0} ativas` },
    { label: 'Produtos Cadastrados', value: stats.totalProducts || 0, icon: Package, color: 'bg-emerald-600', sub: 'em toda plataforma' },
    { label: 'Visitas aos Catálogos', value: stats.totalVisits || 0, icon: Eye, color: 'bg-violet-600', sub: 'últimos 30 dias' },
    { label: 'Gerações com IA', value: stats.totalAIGenerations || 0, icon: Sparkles, color: 'bg-amber-500', sub: `US$ ${Number(stats.totalAICost || 0).toFixed(2)} consumidos` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Dashboard Global</h1>
          <p className="text-gray-500 mt-1">Visão completa da plataforma • Controle total</p>
        </div>
        <Link to="/super-admin/lojas" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-md transition-colors">
          <Plus className="w-4 h-4" /> Nova Loja
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(c => (
          <Card key={c.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{c.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${c.color} flex items-center justify-center text-white shadow-md`}>
                <c.icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Activity className="w-5 h-5 text-sky-600" /> Lojas Recentes</h3>
            <Link to="/super-admin/lojas" className="text-sm text-sky-600 font-medium hover:text-sky-700 flex items-center gap-1">Ver todas <ArrowUpRight className="w-4 h-4" /></Link>
          </div>
          <div className="space-y-3">
            {data?.recentStores?.length ? data.recentStores.map((s: any) => (
              <Link key={s.id} to={`/super-admin/lojas/${s.id}`} className="flex items-center justify-between p-3 rounded-xl border hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">/{s.slug} • {new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <Badge variant={s.status === 'active' ? 'success' : s.status === 'suspended' ? 'danger' : 'warning'}>{s.status === 'active' ? 'Ativa' : s.status === 'suspended' ? 'Suspensa' : s.status}</Badge>
              </Link>
            )) : <p className="text-sm text-gray-500 py-8 text-center">Nenhuma loja ainda. Crie a primeira!</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Atividade Recente</h3>
          <div className="space-y-3">
            {data?.recentActivity?.length ? data.recentActivity.slice(0,5).map((a: any) => (
              <div key={a.id} className="flex gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-600">{a.user_name?.[0] || 'S'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900"><span className="font-medium">{a.user_name || 'Sistema'}</span> <span className="text-gray-500">{a.action}</span></p>
                  <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )) : <p className="text-sm text-gray-500 py-8 text-center">Nenhuma atividade ainda.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-to-r from-slate-900 to-sky-900 text-white border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold">Pronto para crescer?</h3>
            <p className="text-slate-300 mt-1">Cadastre novas lojas, configure limites de IA e acompanhe o crescimento da plataforma.</p>
          </div>
          <Link to="/super-admin/lojas" className="px-6 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">Gerenciar Lojas →</Link>
        </div>
      </Card>
    </div>
  );
}
