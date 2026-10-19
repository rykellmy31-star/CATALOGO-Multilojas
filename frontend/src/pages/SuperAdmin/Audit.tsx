import { useEffect, useState } from 'react';
import api, { formatDate } from '../../lib/api';
import { Card, Badge } from '../../components/ui/Button';
import { Shield, Clock, User, Store } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p=1) => {
    setLoading(true);
    try { const { data } = await api.get('/superadmin/audit-logs', { params: { page: p, limit: 20 } }); setLogs(data.logs || []); setTotal(data.pagination?.total || 0); } catch {} finally { setLoading(false); }
  };
  useEffect(()=>{fetchLogs(page);},[page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2"><Shield className="w-7 h-7 text-slate-700" /> Auditoria & Logs</h1>
        <p className="text-gray-500 mt-1">{total} registros • Histórico completo de ações</p>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" /> Todos os acessos de suporte, criações, edições e exclusões são registrados aqui com IP e user-agent para compliance.
        </div>
        {loading ? <div className="p-8 text-center text-gray-500">Carregando...</div> :
          logs.length === 0 ? <div className="p-12 text-center text-gray-500">Nenhum log ainda.</div> :
          <div className="divide-y">
            {logs.map((log:any)=>(
              <div key={log.id} className="p-4 flex gap-4 hover:bg-gray-50">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {log.user_name?.[0] || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{log.user_name || log.user_email || 'Sistema'}</span>
                    <Badge variant="info">{log.action}</Badge>
                    {log.entity_type && <span className="text-xs text-gray-500">{log.entity_type}/{log.entity_id?.slice(0,8)}</span>}
                    {log.store_name && <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full"><Store className="w-3 h-3" />{log.store_name}</span>}
                  </div>
                  {log.details && <p className="text-xs text-gray-500 mt-1 font-mono truncate">{log.details}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(log.created_at).toLocaleString('pt-BR')} {log.ip_address && `• IP: ${log.ip_address}`}</p>
                </div>
              </div>
            ))}
          </div>
        }
        <div className="p-4 border-t flex items-center justify-between bg-gray-50">
          <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50 text-sm">Anterior</button>
          <span className="text-sm text-gray-600">Página {page}</span>
          <button disabled={logs.length < 20} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50 text-sm">Próxima</button>
        </div>
      </Card>
    </div>
  );
}
