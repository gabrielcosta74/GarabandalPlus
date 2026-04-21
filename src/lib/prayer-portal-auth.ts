import { supabaseServer } from './supabase';

export type PortalAuthResult =
  | { authorized: true; user: { id: string; email: string } }
  | { authorized: false; error: string };

export async function verifyPortalAccess(req: Request): Promise<PortalAuthResult> {
  if (!supabaseServer) return { authorized: false, error: 'Erro de configuração do servidor' };

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!token) return { authorized: false, error: 'Token em falta' };

  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user?.email) return { authorized: false, error: 'Sessão inválida' };

  const { data } = await supabaseServer
    .from('prayer_managers')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (!data) return { authorized: false, error: 'Conta não autorizada para este portal' };

  return { authorized: true, user: { id: user.id, email: user.email } };
}
