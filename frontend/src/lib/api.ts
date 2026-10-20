import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Não sobrescreve credenciais explícitas (ex.: logout da sessão anterior).
  const explicitAuth = config.headers.Authorization !== undefined
    || config.headers.authorization !== undefined
    || (typeof config.headers.has === 'function' && config.headers.has('Authorization'));
  if (token && !explicitAuth) config.headers.Authorization = `Bearer ${token}`;
  
  // Session ID para analytics
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sessionId', sessionId);
  }
  config.headers['X-Session-Id'] = sessionId;
  
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const authorization = error.config?.headers?.get?.('Authorization')
      ?? error.config?.headers?.Authorization
      ?? error.config?.headers?.authorization;
    const requestToken = typeof authorization === 'string'
      ? /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]
      : undefined;
    const currentToken = localStorage.getItem('token');
    const requestUrl = error.config?.url || '';
    const isLoginRequest = /(?:^|\/)auth\/(?:login|setup-super-admin)(?:[?#]|$)/.test(requestUrl);
    // Um 401 antigo, anônimo ou de credenciais inválidas não pode derrubar a sessão atual.
    if (error.response?.status === 401 && currentToken && requestToken === currentToken && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Não redireciona se já estiver em login/setup
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Helpers
export const formatPrice = (price: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/sem-imagem.svg';
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/api')) return url;
  return url;
};

export const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');
