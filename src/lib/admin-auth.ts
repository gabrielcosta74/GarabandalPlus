import { supabaseServer } from './supabase';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'geral@apostoladodegarabandal.com';

export const requireAdmin = async (request: Request) => {
  if (!supabaseServer) {
    return { ok: false, status: 500, message: 'Supabase não configurado.' } as const;
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Token ausente.' } as const;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data?.user) {
    return { ok: false, status: 401, message: 'Token inválido.' } as const;
  }

  const email = data.user.email || '';
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, status: 403, message: 'Acesso não autorizado.' } as const;
  }

  return { ok: true, user: data.user } as const;
};
