import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Shared/Login';
import Setup from './pages/Shared/Setup';
import SuperDashboard from './pages/SuperAdmin/Dashboard';
import Stores from './pages/SuperAdmin/Stores';
import StoreDetail from './pages/SuperAdmin/StoreDetail';
import PlatformConfig from './pages/SuperAdmin/Platform';
import AuditLogs from './pages/SuperAdmin/Audit';
import SupportView from './pages/SuperAdmin/SupportView';
import StoreDashboard from './pages/StoreAdmin/Dashboard';
import Products from './pages/StoreAdmin/Products';
import ProductForm from './pages/StoreAdmin/ProductForm';
import Categories from './pages/StoreAdmin/Categories';
import Brands from './pages/StoreAdmin/Brands';
import Banners from './pages/StoreAdmin/Banners';
import Settings from './pages/StoreAdmin/Settings';
import Analytics from './pages/StoreAdmin/Analytics';
import Catalog from './pages/PublicCatalog/Catalog';
import ProductDetail from './pages/PublicCatalog/ProductDetail';
import { SuperAdminLayout, StoreAdminLayout } from './components/layout/Layout';
import { Toaster } from 'sonner';

function Protected({ children, role }: { children: React.ReactNode; role?: 'super_admin' | 'store_admin' }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/" element={loading ? <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div> : user ? (user.role === 'super_admin' ? <Navigate to="/super-admin" /> : <Navigate to="/admin" />) : <Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />

      {/* Super Admin */}
      <Route path="/super-admin" element={<Protected role="super_admin"><SuperAdminLayout><SuperDashboard /></SuperAdminLayout></Protected>} />
      <Route path="/super-admin/lojas" element={<Protected role="super_admin"><SuperAdminLayout><Stores /></SuperAdminLayout></Protected>} />
      <Route path="/super-admin/lojas/:id" element={<Protected role="super_admin"><SuperAdminLayout><StoreDetail /></SuperAdminLayout></Protected>} />
      <Route path="/super-admin/plataforma" element={<Protected role="super_admin"><SuperAdminLayout><PlatformConfig /></SuperAdminLayout></Protected>} />
      <Route path="/super-admin/auditoria" element={<Protected role="super_admin"><SuperAdminLayout><AuditLogs /></SuperAdminLayout></Protected>} />
      <Route path="/super-admin/lojas/:id/suporte" element={<Protected role="super_admin"><SuperAdminLayout><SupportView /></SuperAdminLayout></Protected>} />

      {/* Store Admin */}
      <Route path="/admin" element={<Protected role="store_admin"><StoreAdminLayout><StoreDashboard /></StoreAdminLayout></Protected>} />
      <Route path="/admin/produtos" element={<Protected role="store_admin"><StoreAdminLayout><Products /></StoreAdminLayout></Protected>} />
      <Route path="/admin/produtos/novo" element={<Protected role="store_admin"><StoreAdminLayout><ProductForm /></StoreAdminLayout></Protected>} />
      <Route path="/admin/produtos/:id/editar" element={<Protected role="store_admin"><StoreAdminLayout><ProductForm /></StoreAdminLayout></Protected>} />
      <Route path="/admin/categorias" element={<Protected role="store_admin"><StoreAdminLayout><Categories /></StoreAdminLayout></Protected>} />
      <Route path="/admin/marcas" element={<Protected role="store_admin"><StoreAdminLayout><Brands /></StoreAdminLayout></Protected>} />
      <Route path="/admin/banners" element={<Protected role="store_admin"><StoreAdminLayout><Banners /></StoreAdminLayout></Protected>} />
      <Route path="/admin/estatisticas" element={<Protected role="store_admin"><StoreAdminLayout><Analytics /></StoreAdminLayout></Protected>} />
      <Route path="/admin/configuracoes" element={<Protected role="store_admin"><StoreAdminLayout><Settings /></StoreAdminLayout></Protected>} />

      {/* Public */}
      <Route path="/loja/:slug" element={<Catalog />} />
      <Route path="/loja/:slug/produto/:productSlug" element={<ProductDetail />} />

      <Route path="*" element={<div className="min-h-screen flex items-center justify-center p-6"><div className="text-center"><h1 className="text-6xl font-bold text-gray-200">404</h1><p className="text-gray-500 mt-2">Página não encontrada</p><a href="/" className="mt-4 inline-flex px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium">Voltar ao início</a></div></div>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
