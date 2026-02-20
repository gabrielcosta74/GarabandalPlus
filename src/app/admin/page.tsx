"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

async function verifyAdminAccess(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const [sessionChecking, setSessionChecking] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState({ email: 'geral@apostoladodegarabandal.com', password: '' });
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        if (!supabaseBrowser) {
          return;
        }

        const { data: { session } } = await supabaseBrowser.auth.getSession();

        if (session?.user) {
          const hasAdminAccess = await verifyAdminAccess(session.access_token);
          if (hasAdminAccess) {
            router.replace('/admin/dashboard');
            return;
          }

          if (mounted) {
            setError('Esta conta não tem permissões de administrador.');
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        if (mounted) setSessionChecking(false);
      }
    };

    checkSession();
    return () => { mounted = false; };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser || loginLoading) return;

    setError(null);
    setLoginLoading(true);

    try {
      const { data, error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: login.email.trim(),
        password: login.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.session) {
        const hasAdminAccess = await verifyAdminAccess(data.session.access_token);
        if (!hasAdminAccess) {
          setError('Esta conta não tem permissões de administrador.');
          return;
        }

        router.replace('/admin/dashboard');
      } else {
        setError("Erro desconhecido ao iniciar sessão.");
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Ocorreu um erro ao tentar entrar.');
    } finally {
      setLoginLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-garabandal-gold animate-spin" />
          <p className="text-sm text-gray-500">A verificar sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-16 h-16 mx-auto bg-garabandal-dark rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-garabandal-dark/20">
          <span className="text-garabandal-gold font-serif text-3xl font-bold">G</span>
        </div>
        <h2 className="text-center text-3xl font-serif font-bold text-gray-900">
          Acesso Administrativo
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Esta área é restrita a administradores.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={login.email}
                  onChange={(e) => setLogin({ ...login, email: e.target.value })}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-garabandal-gold focus:border-garabandal-gold sm:text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={login.password}
                  onChange={(e) => setLogin({ ...login, password: e.target.value })}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-garabandal-gold focus:border-garabandal-gold sm:text-sm transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start gap-2">
                <div className="flex-1 text-sm text-red-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-garabandal-dark hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-garabandal-dark transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 items-center gap-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A entrar...
                </>
              ) : (
                'Entrar em Sistema'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
