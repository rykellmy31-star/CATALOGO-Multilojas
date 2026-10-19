import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, Button } from '../../components/ui/Button';
import { Plus, Trash2, Edit, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function Brands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const fetch = async () => { try { const { data } = await api.get('/store/brands'); setBrands(data.brands || []); } catch {} };
  useEffect(()=>{fetch();},[]);
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      if (editing) { await api.put(`/store/brands/${editing.id}`, { name }); setEditing(null); }
      else await api.post('/store/brands', { name });
      setName('');
      toast.success('Sucesso!');
      fetch();
    } catch { toast.error('Erro'); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir marca?')) return;
    try { await api.delete(`/store/brands/${id}`); toast.success('Removida'); fetch(); } catch { toast.error('Erro'); }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">Marcas</h1>
        <p className="text-gray-500 mt-1">Cadastre as marcas dos seus produtos</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleCreate} className="flex gap-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nova marca (ex: Brastemp, Samsung...)" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
          <Button type="submit">{editing ? 'Salvar' : <><Plus className="w-4 h-4 mr-2" /> Adicionar</>}</Button>
          {editing && <Button type="button" variant="outline" onClick={()=>{setEditing(null); setName('');}}>Cancelar</Button>}
        </form>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.length === 0 ? <Card className="p-8 text-center sm:col-span-3"><Award className="w-8 h-8 text-gray-300 mx-auto" /><p className="text-sm text-gray-500 mt-2">Nenhuma marca. Cadastre agora!</p></Card> :
          brands.map(b=>(
            <Card key={b.id} className="p-4 flex items-center justify-between">
              <div><p className="font-medium text-gray-900">{b.name}</p><p className="text-xs text-gray-500">/{b.slug}</p></div>
              <div className="flex gap-1">
                <button onClick={()=>{setEditing(b); setName(b.name);}} className="p-2 rounded-xl hover:bg-gray-100"><Edit className="w-4 h-4 text-gray-600" /></button>
                <button onClick={()=>handleDelete(b.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
