import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, Badge, Button, Input, Select } from '../../components/ui/Button';
import { ArrowLeft, Trash2, PauseCircle, PlayCircle, ExternalLink, UserPlus, Key, Eye, Copy, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

type AuditResult = {
  store_id: string;
  mode: 'read_only';
  quota: { recorded_used_mb: number; limit_mb: number };
  scanned: {
    objects: number; bytes: number; referenced: number; unreferenced: number;
    older_than_7_days_for_review: number; unknown_upload_date: number;
  };
  review_candidates: { key: string; size_bytes: number; uploaded_at: string }[];
  pagination: { has_more: boolean; next_cursor: string | null };
  complete_store_scan: boolean;
};

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>(null);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [audit, setAudit] = useState<{ storeId: string; result: AuditResult } | null>(null);
  const [auditing, setAuditing] = useState(false);
  const auditController = useRef<AbortController | null>(null);

  const fetchStorageAudit = async (cursor?: string) => {
    if (!id) return;
    auditController.current?.abort();
    const controller = new AbortController();
    auditController.current = controller;
    setAuditing(true);
    try {
      const { data } = await api.get(`/superadmin/stores/${id}/storage-audit`, {
        params: { limit: 100, ...(cursor ? { cursor } : {}) },
        signal: controller.signal
      });
      if (!controller.signal.aborted) setAudit({ storeId: id, result: data });
    } catch (err: any) {
      if (!controller.signal.aborted) toast.error(err?.response?.data?.error || 'Não foi possível auditar o armazenamento');
    } finally {
      if (auditController.current === controller) {
        auditController.current = null;
        setAuditing(false);
      }
    }
  };

  useEffect(() => {
    setAudit(null);
    return () => {
      auditController.current?.abort();
      auditController.current = null;
    };
  }, [id]);

  const fetchStore = async () => {
    try {
      const { data } = await api.get(`/superadmin/stores/${id}`);
      setStore(data.store);
      setEdit(data.store);
      setAdmins(data.admins?.results || data.admins || []);
    } catch { toast.error('Erro ao carregar loja'); } finally { setLoading(false); }
  };
  useEffect(()=>{ fetchStore(); }, [id]);

  const handleSave = async () => {
    try {
      await api.put(`/superadmin/stores/${id}`, edit);
      toast.success('Loja atualizada!');
      fetchStore();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleToggleStatus = async () => {
    const newStatus = store.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/superadmin/stores/${id}`, { status: newStatus });
      toast.success(`Loja ${newStatus === 'suspended' ? 'suspensa' : 'reativada'}!`);
      fetchStore();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    try { await api.delete(`/superadmin/stores/${id}`); toast.success('Loja removida'); navigate('/super-admin/lojas'); } catch { toast.error('Erro ao remover'); }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) return toast.error('Preencha todos os campos');
    try {
      await api.post(`/superadmin/stores/${id}/admins`, newAdmin);
      toast.success('Administrador criado!');
      setNewAdmin({ name: '', email: '', password: '' });
      setShowAdminForm(false);
      fetchStore();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro ao criar admin'); }
  };

  const handleResetPassword = async (adminId: string) => {
    const pwd = prompt('Nova senha (mín. 6 caracteres):');
    if (!pwd || pwd.length < 6) return;
    try { await api.put(`/superadmin/stores/${id}/admins/${adminId}/reset-password`, { password: pwd }); toast.success('Senha redefinida!'); } catch { toast.error('Erro'); }
  };

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;
  if (!store) return <div className="text-center py-12">Loja não encontrada</div>;

  return (
    <div className="space-y-6">
      <Link to="/super-admin/lojas" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Voltar para lojas
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl" style={{ background: store.primary_color || '#0ea5e9' }}>{store.name[0]}</div>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">{store.name}</h1>
            <p className="text-sm text-gray-500">/{store.slug} • Criada em {new Date(store.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
          <Badge variant={store.status === 'active' ? 'success' : 'danger'}>{store.status}</Badge>
        </div>
        <div className="flex gap-2">
          <a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 font-medium text-sm">
            <ExternalLink className="w-4 h-4" /> Ver Catálogo
          </a>
          <Button variant={store.status === 'active' ? 'outline' : 'primary'} onClick={handleToggleStatus}>
            {store.status === 'active' ? <><PauseCircle className="w-4 h-4 mr-2" /> Suspender</> : <><PlayCircle className="w-4 h-4 mr-2" /> Reativar</>}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Dados da Loja</h3>
          <div className="space-y-4">
            <Input label="Nome" value={edit.name || ''} onChange={e=>setEdit({...edit, name: e.target.value})} />
            <Input label="Slug (URL)" value={edit.slug || ''} onChange={e=>setEdit({...edit, slug: e.target.value})} hint={`${window.location.origin}/loja/${edit.slug || store.slug}`} />
            <Input label="Descrição" value={edit.description || ''} onChange={e=>setEdit({...edit, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="WhatsApp" value={edit.whatsapp || ''} onChange={e=>setEdit({...edit, whatsapp: e.target.value})} />
              <Input label="Email" value={edit.email || ''} onChange={e=>setEdit({...edit, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cidade" value={edit.city || ''} onChange={e=>setEdit({...edit, city: e.target.value})} />
              <Input label="Estado" value={edit.state || ''} onChange={e=>setEdit({...edit, state: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs font-medium text-gray-700">Cor Primária</label><input type="color" value={edit.primary_color || '#0ea5e9'} onChange={e=>setEdit({...edit, primary_color: e.target.value})} className="w-full h-10 rounded-xl border mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-700">Secundária</label><input type="color" value={edit.secondary_color || '#0f172a'} onChange={e=>setEdit({...edit, secondary_color: e.target.value})} className="w-full h-10 rounded-xl border mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-700">Destaque</label><input type="color" value={edit.accent_color || '#f59e0b'} onChange={e=>setEdit({...edit, accent_color: e.target.value})} className="w-full h-10 rounded-xl border mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Plano" value={edit.plan || 'free'} onChange={e=>setEdit({...edit, plan: e.target.value})}>
                <option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
              </Select>
              <Select label="Status" value={edit.status || 'active'} onChange={e=>setEdit({...edit, status: e.target.value})}>
                <option value="active">Ativa</option><option value="suspended">Suspensa</option><option value="pending">Pendente</option>
              </Select>
            </div>
            <Input label="Limite Armazenamento (MB)" type="number" value={edit.storage_limit_mb ?? 1024} onChange={e=>setEdit({...edit, storage_limit_mb: parseInt(e.target.value)})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Limite IA Diário" type="number" value={edit.ai_daily_limit ?? 10} onChange={e=>setEdit({...edit, ai_daily_limit: parseInt(e.target.value)})} />
              <Input label="Limite IA Mensal" type="number" value={edit.ai_monthly_limit ?? 100} onChange={e=>setEdit({...edit, ai_monthly_limit: parseInt(e.target.value)})} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave}>Salvar Alterações</Button>
              <Button variant="danger" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" /> Excluir Loja</Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Administradores da Loja</h3>
            <Button size="sm" onClick={()=>setShowAdminForm(!showAdminForm)}><UserPlus className="w-4 h-4 mr-1" /> Novo Admin</Button>
          </div>

          {showAdminForm && (
            <form onSubmit={handleCreateAdmin} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <Input placeholder="Nome" value={newAdmin.name} onChange={e=>setNewAdmin({...newAdmin, name: e.target.value})} required />
              <Input type="email" placeholder="Email" value={newAdmin.email} onChange={e=>setNewAdmin({...newAdmin, email: e.target.value})} required />
              <Input type="password" placeholder="Senha (mín. 8)" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} required />
              <div className="flex gap-2">
                <Button type="submit" size="sm">Criar</Button>
                <Button type="button" variant="outline" size="sm" onClick={()=>setShowAdminForm(false)}>Cancelar</Button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {admins.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center">Nenhum administrador cadastrado.</p> :
              admins.map((a:any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.email}</p>
                    {a.last_login_at && <p className="text-xs text-gray-400">Último acesso: {new Date(a.last_login_at).toLocaleString('pt-BR')}</p>}
                  </div>
                  <button onClick={()=>handleResetPassword(a.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Redefinir senha">
                    <Key className="w-4 h-4" />
                  </button>
                </div>
              ))
            }
          </div>

          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium text-gray-900 text-sm mb-3">Suporte</h4>
            <Link to={`/super-admin/lojas/${store.id}/suporte`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100">
              <Eye className="w-4 h-4" /> Visualização de Suporte (com auditoria)
            </Link>
            <p className="text-xs text-gray-500 mt-2">Acesse a visão da loja para ajudar o cliente. Todo acesso é registrado nos logs.</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-sky-600" /> Auditoria do armazenamento R2
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Verificação manual, somente leitura. Nenhum arquivo será excluído e nenhuma cota será modificada.
            </p>
          </div>
          <Button variant="outline" disabled={auditing} loading={auditing}
            onClick={() => fetchStorageAudit()}>
            {audit?.storeId === id ? 'Reiniciar auditoria' : 'Verificar arquivos'}
          </Button>
        </div>

        {audit?.storeId === id && (
          <div className="mt-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="border rounded-xl p-3 bg-gray-50">
                <p className="text-gray-500">Uso registrado</p>
                <p className="font-semibold">{audit.result.quota.recorded_used_mb.toFixed(2)} / {audit.result.quota.limit_mb} MB</p>
              </div>
              <div className="border rounded-xl p-3 bg-gray-50">
                <p className="text-gray-500">Objetos nesta página</p>
                <p className="font-semibold">{audit.result.scanned.objects} ({(audit.result.scanned.bytes / 1048576).toFixed(2)} MB)</p>
              </div>
              <div className="border rounded-xl p-3 bg-gray-50">
                <p className="text-gray-500">Candidatos à revisão</p>
                <p className="font-semibold">{audit.result.scanned.older_than_7_days_for_review}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {audit.result.scanned.referenced} arquivos referenciados e {audit.result.scanned.unreferenced} sem referência conhecida nesta página.
              {audit.result.scanned.unknown_upload_date > 0 && ` ${audit.result.scanned.unknown_upload_date} sem data verificável.`}
            </p>
            {audit.result.review_candidates.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">Arquivos para revisão manual (mais de 7 dias)</p>
                <div className="space-y-2 max-h-56 overflow-auto rounded-xl border p-3">
                  {audit.result.review_candidates.slice(0, 10).map(candidate => (
                    <div key={candidate.key} className="text-xs text-gray-600 break-all">
                      {candidate.key} — {(candidate.size_bytes / 1024).toFixed(1)} KB
                    </div>
                  ))}
                  {audit.result.review_candidates.length > 10 && (
                    <p className="text-xs text-gray-500">
                      Mais {audit.result.review_candidates.length - 10} arquivos nesta página.
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-amber-700">
              Arquivos sem referência podem pertencer a edições ainda não salvas. Não exclua nem
              ajuste a cota apenas com base nesta auditoria.
            </p>
            {audit.result.pagination.has_more ? (
              <Button variant="outline" disabled={auditing || !audit.result.pagination.next_cursor}
                loading={auditing}
                onClick={() => {
                  if (audit.result.pagination.next_cursor) {
                    fetchStorageAudit(audit.result.pagination.next_cursor);
                  }
                }}>Próxima página de arquivos</Button>
            ) : (
              <p className="text-xs text-gray-500">
                {audit.result.complete_store_scan
                  ? 'A listagem inteira da loja coube nesta página.'
                  : 'Fim desta consulta paginada.'}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
