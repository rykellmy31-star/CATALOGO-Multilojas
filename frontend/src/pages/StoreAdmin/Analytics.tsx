import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card } from '../../components/ui/Button';
import { Eye, MousePointer, TrendingUp, BarChart3 } from 'lucide-react';

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    api.get('/store/analytics').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-7 h-7 text-sky-600" /> Estatísticas</h1>
        <p className="text-gray-500 mt-1">Acompanhe visualizações e cliques no seu catálogo</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Eye className="w-5 h-5 text-violet-600" /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Visitas totais</p>
              <p className="text-2xl font-bold">{data?.chart?.reduce((s:number, i:any)=>s+(i.count||0),0) || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><MousePointer className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm font-medium text-gray-500">Produtos mais vistos</p>
              <p className="text-sm text-gray-600">{data?.topProducts?.length || 0} produtos com visualizações</p>
            </div>
          </div>
        </Card>
      </div>
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-sky-600" /> Produtos Mais Acessados</h3>
        {data?.topProducts?.length ? (
          <div className="space-y-3">
            {data.topProducts.map((p:any, idx:number)=>(
              <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{idx+1}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="text-sm font-semibold text-sky-600">{p.views} views</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500 py-8 text-center">Nenhum dado ainda. Compartilhe seu catálogo para começar a ver estatísticas!</p>}
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Visitas por dia (últimos 30 dias)</h3>
        {data?.chart?.length ? (
          <div className="space-y-1">
            {data.chart.map((d:any)=>(
              <div key={d.date} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-xs text-gray-500">{d.date}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-600 rounded-full" style={{ width: `${Math.min(100, d.count * 10)}%` }} />
                </div>
                <span className="w-8 text-xs font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500 text-center py-6">Sem dados ainda</p>}
      </Card>
    </div>
  );
}
