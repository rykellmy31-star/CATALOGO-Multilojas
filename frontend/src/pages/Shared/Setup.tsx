import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card } from '../../components/ui/Button';
import api from '../../lib/api';
import { Shield, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';

export default function Setup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ setupToken: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    api.get('/auth/check-setup').then(r => setNeedsSetup(r.data.needsSetup)).catch(()=>setNeedsSetup(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/setup-super-admin', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);
      setTimeout(()=> window.location.assign('/super-admin'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar Super Admin');
    } finally { setLoading(false); }
  };

  if (needsSetup === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold mt-4">Plataforma já configurada</h2>
          <p className="text-gray-500 mt-2">O Super Administrador já existe. Faça login normalmente.</p>
          <Link to="/login" className="mt-6 inline-flex px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium">Ir para Login</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-sky-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-sky-600" />
          </div>
          <h1 className="font-display text-3xl font-bold mt-4">Configuração Inicial</h1>
          <p className="text-slate-300 mt-2">Crie o primeiro Super Administrador da plataforma</p>
        </div>

        <Card className="p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-600 mx-auto" />
              <h3 className="text-xl font-bold mt-3">Sucesso!</h3>
              <p className="text-gray-500 mt-2">Super Admin criado. Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Token de configuração necessário</p>
                  <p className="text-xs mt-1">Use o token privado fornecido pelo responsável pela implantação.</p>
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

              <Input label="Token de Configuração" type="password" placeholder="Seu token privado" value={form.setupToken} onChange={e=>setForm({...form, setupToken: e.target.value})} required autoComplete="off" />
              <Input label="Nome Completo" placeholder="Administrador Master" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
              <Input label="Email" type="email" placeholder="admin@plataforma.com" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required />
              <Input label="Senha (mínimo 8 caracteres)" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} required />

              <Button type="submit" loading={loading} className="w-full" size="lg">
                <Sparkles className="w-4 h-4 mr-2" /> Criar Super Administrador
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Este processo só pode ser executado uma vez. Após criar o Super Admin, o setup é desabilitado automaticamente.
              </p>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-slate-400 mt-6">
          Já possui acesso? <Link to="/login" className="text-white font-medium underline">Fazer login</Link>
        </p>
      </div>
    </div>
  );
}
