import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Card } from '../../components/ui/Button';
import { Sparkles, Store, Shield, Eye } from 'lucide-react';
import api from '../../lib/api';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api.get('/auth/check-setup').then(r => setNeedsSetup(r.data.needsSetup)).catch(()=>{});
    if (user) {
      if (user.role === 'super_admin') navigate('/super-admin');
      else navigate('/admin');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.role === 'super_admin') navigate('/super-admin');
      else {
        // salva slug da loja para links públicos
        try {
          const { data } = await api.get('/store/settings');
          if (data.store?.slug) localStorage.setItem('storeSlug', data.store.slug);
        } catch {}
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally { setLoading(false); }
  };

  const fillDemo = (role: 'super' | 'loja1' | 'loja2') => {
    if (role === 'super') { setEmail('super@catalogospro.com'); setPassword('Super123!'); }
    if (role === 'loja1') { setEmail('admin@moveispremium.com'); setPassword('Loja123!'); }
    if (role === 'loja2') { setEmail('admin@eletrocenter.com'); setPassword('Loja123!'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-sky-600" />
            </div>
            <span className="font-display font-bold text-xl">Catálogos Pro</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-bold leading-tight">Catálogos que <span className="text-sky-400">vendem.</span></h1>
            <p className="text-lg text-slate-300 mt-6 leading-relaxed">Plataforma profissional multilojas com Inteligência Artificial. Transforme fotos simples em anúncios que convertem.</p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
                <Store className="w-8 h-8 text-sky-400" />
                <p className="font-semibold mt-2">Multilojas</p>
                <p className="text-xs text-slate-300">Cada loja com seu catálogo exclusivo</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
                <Sparkles className="w-8 h-8 text-amber-400" />
                <p className="font-semibold mt-2">IA Integrada</p>
                <p className="text-xs text-slate-300">Descrições e imagens profissionais</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Catálogos Pro. Sistema profissional SaaS.</p>
      </div>

      {/* Right - Login */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:rounded-l-[2.5rem] lg:shadow-2xl">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
            <span className="font-display font-bold text-xl">Catálogos Pro</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">Bem-vindo de volta</h2>
            <p className="text-gray-500 mt-2">Entre com suas credenciais para continuar</p>
          </div>

          {needsSetup && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Primeiro acesso?</p>
                <p className="text-amber-700">Nenhum Super Admin configurado. <Link to="/setup" className="font-semibold underline">Configure agora</Link></p>
              </div>
            </div>
          )}

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input label="Email" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              <Input label="Senha" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <Button type="submit" loading={loading} className="w-full" size="lg">Entrar na Plataforma</Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Acesso rápido (demo)</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={()=>fillDemo('super')} className="px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 flex flex-col items-center gap-1">
                  <Shield className="w-4 h-4" /> Super Admin
                </button>
                <button onClick={()=>fillDemo('loja1')} className="px-3 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 flex flex-col items-center gap-1">
                  <Store className="w-4 h-4" /> Móveis
                </button>
                <button onClick={()=>fillDemo('loja2')} className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 flex flex-col items-center gap-1">
                  <Store className="w-4 h-4" /> Eletro
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">Senhas: Super123! / Loja123!</p>
            </div>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">Quer ver os catálogos públicos?</p>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              <Link to="/loja/moveis-premium" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium"><Eye className="w-3 h-3" /> Móveis Premium</Link>
              <Link to="/loja/eletro-center" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium"><Eye className="w-3 h-3" /> Eletro Center</Link>
              <Link to="/loja/decor-art" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium"><Eye className="w-3 h-3" /> Decor Art</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
