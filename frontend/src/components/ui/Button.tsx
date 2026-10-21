import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant='primary', size='md', loading, children, className='', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string,string> = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md hover:shadow-lg focus:ring-sky-500',
    secondary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-md focus:ring-slate-500',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-sky-500',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md focus:ring-red-500',
  };
  const sizes: Record<string,string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base',
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
      {children}
    </button>
  );
}

export function Card({ children, className='', hover=false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${hover ? 'hover:shadow-md hover:border-gray-200 transition-all' : ''} ${className}`}>{children}</div>;
}

export function Badge({ children, variant='default', className='' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const map: Record<string,string> = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-sky-50 text-sky-700 border border-sky-200',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[variant]} ${className}`}>{children}</span>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  const { label, error, hint, className='', ...rest } = props;
  const generatedId = React.useId();
  const id = props.id || generatedId;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <input id={id} aria-invalid={!!error} className={`w-full px-4 py-2.5 rounded-xl border ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-sky-500 focus:border-sky-500'} bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors ${className}`} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const { label, error, className='', ...rest } = props;
  const generatedId = React.useId();
  const id = props.id || generatedId;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <textarea id={id} aria-invalid={!!error} className={`w-full px-4 py-2.5 rounded-xl border ${error ? 'border-red-300' : 'border-gray-200'} bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors ${className}`} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, children, error, className='', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  const generatedId = React.useId();
  const id = props.id || generatedId;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <select id={id} aria-invalid={!!error} className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${className}`} {...props}>{children}</select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
