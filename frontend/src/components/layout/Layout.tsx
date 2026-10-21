import api from '../../lib/api';
import { getWhatsAppContactUrl } from '../../lib/whatsapp';
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, Store, Package, Tag, Award, Image as ImageIcon,
  Settings, LogOut, Menu, X, Sparkles, BarChart3, Home,
  ShoppingBag, Eye, Bell, ChevronDown
} from 'lucide-react';

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const nav = [
    { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/super-admin/lojas', icon: Store, label: 'Lojas' },
    { to: '/super-admin/plataforma', icon: Settings, label: 'Plataforma' },
    { to: '/super-admin/auditoria', icon: Bell, label: 'Auditoria' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col transition-transform duration-300`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none">Catálogos Pro</h1>
              <p className="text-xs text-slate-400">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={()=>setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                <item.icon className="w-5 h-5" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800">
            <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-sm font-bold">{user?.name?.[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 lg:hidden z-40" onClick={()=>setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between lg:justify-end">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl hover:bg-gray-100">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-600">Bem-vindo,</span>
            <span className="text-sm font-semibold text-gray-900">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [catalogSlug, setCatalogSlug] = useState('');
  useEffect(() => { api.get('/store/settings').then(r => setCatalogSlug(r.data.store?.slug || '')).catch(() => {}); }, [location.pathname]);
  const handleLogout = () => { logout(); navigate('/login'); };

  const nav = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/admin/produtos', icon: Package, label: 'Produtos' },
    { to: '/admin/categorias', icon: Tag, label: 'Categorias' },
    { to: '/admin/marcas', icon: Award, label: 'Marcas' },
    { to: '/admin/banners', icon: ImageIcon, label: 'Banners' },
    { to: '/admin/estatisticas', icon: BarChart3, label: 'Estatísticas' },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transition-transform`}>
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-gray-900 leading-none">Minha Loja</h1>
              <p className="text-xs text-gray-500">Painel Administrativo</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={()=>setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'bg-sky-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <item.icon className="w-5 h-5" /> {item.label}
              </Link>
            );
          })}
          <div className="pt-4 mt-4 border-t">
            <a href={catalogSlug ? `/loja/${catalogSlug}` : '/admin/configuracoes'} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sky-600 hover:bg-sky-50">
              <Eye className="w-5 h-5" /> Ver Catálogo
            </a>
          </div>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">{user?.name?.[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
          <button onClick={handleLogout} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 lg:hidden z-40" onClick={()=>setSidebarOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl hover:bg-gray-100">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 hidden sm:inline">Painel da Loja</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900 hidden sm:inline">{user?.name}</span>
            <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white text-sm font-bold">{user?.name?.[0]}</div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PublicLayout({ children, store, categories }: { children: React.ReactNode; store?: any; categories?: any[] }) {
  const whatsappUrl = getWhatsAppContactUrl(store?.whatsapp);
  return (
    <div className="min-h-screen bg-white">
      {/* Header Loja */}
      {store && (
        <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to={`/loja/${store.slug}`} className="flex min-w-0 max-w-[75%] items-center gap-3">
                {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-9 max-w-24 object-contain" /> : <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: store.primary_color || '#0ea5e9' }}>{store.name[0]}</div>}
                <span className="font-display font-bold text-base sm:text-xl text-gray-900 truncate">{store.name}</span>
              </Link>
              <div className="flex items-center gap-2">
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium" style={{ background: '#25D366' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 0 0-10 18.5L0 24l5.7-1.5A12 12 0 1 0 12 0zm5.4 17.3c-.2.6-1.2 1.1-1.7 1.1-.4 0-.8.1-2.7-.6-2.3-1-3.7-3.3-3.8-3.5-.1-.1-1-1.3-1-2.5s.6-1.8.8-2c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .4.3l.7 1.7c0 .1 0 .3-.1.4l-.3.4c-.1.1-.2.2-.1.4.1.2.5.8 1 1.3.7.7 1.2 1 1.4 1.1.1.1.3 0 .4-.1l.5-.6c.1-.1.2-.1.4 0l1.6.8c.1.1.2.1.2.3v.4c0 .2-.1.6-.3.8z"/></svg>
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Categories bar */}
          {categories && categories.length > 0 && (
            <div className="border-t bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
                  <Link to={`/loja/${store.slug}`} className="whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-900 text-white text-sm font-medium">Todos</Link>
                  {categories.map((cat: any) => (
                    <Link key={cat.id} to={`/loja/${store.slug}?categoria=${cat.slug}`} className="whitespace-nowrap px-4 py-1.5 rounded-full bg-white border text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50">
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </header>
      )}
      {children}
      {store && (
        <footer className="bg-slate-900 text-white mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-display font-bold text-lg">{store.name}</h3>
                <p className="text-sm text-slate-300 mt-2">{store.description || 'Qualidade e confiança para sua casa.'}</p>
                {store.address && <p className="text-sm text-slate-400 mt-3">📍 {store.address} {store.city && `- ${store.city}/${store.state}`}</p>}
              </div>
              <div>
                <h4 className="font-semibold text-sm">Contato</h4>
                <div className="text-sm text-slate-300 mt-3 space-y-1">
                  {store.phone && <p>📞 {store.phone}</p>}
                  {store.whatsapp && <p>💬 {store.whatsapp}</p>}
                  {store.email && <p>✉️ {store.email}</p>}
                  {store.instagram && <p>📸 {store.instagram}</p>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Horário</h4>
                <p className="text-sm text-slate-300 mt-3">{store.opening_hours || 'Segunda a Sábado: 08h às 18h'}</p>
              </div>
            </div>
            <div className="border-t border-slate-800 mt-8 pt-6 text-center text-xs text-slate-400">
              <p>{store.footer_text || 'Sistema desenvolvido por Catálogos Pro'}</p>
              <p className="mt-1">© {new Date().getFullYear()} {store.name}. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
