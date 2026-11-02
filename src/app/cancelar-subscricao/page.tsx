import { supabaseServer } from '../../lib/supabase';
import { decodeUnsubscribeEmail, verifyUnsubscribeToken } from '../../lib/unsubscribe-token';
import { applyMarketingUnsubscribe } from '../../lib/marketing-unsubscribe';
import UnsubscribeResult from '../../components/marketing/UnsubscribeResult';

export const dynamic = 'force-dynamic';

export default async function CancelarSubscricaoPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; confirm?: string }>;
}) {
  const { e = '', t = '', confirm = '' } = await searchParams;
  const email = decodeUnsubscribeEmail(e);

  // Só cancela depois de a pessoa carregar no botão (confirm=1): abrir a ligação
  // não chega, para que verificadores automáticos de ligações não descadastrem ninguém.
  let status: 'confirm' | 'success' | 'invalid' | 'error' = 'invalid';
  if (email && verifyUnsubscribeToken(email, t) && supabaseServer) {
    if (confirm !== '1') {
      status = 'confirm';
    } else {
      const result = await applyMarketingUnsubscribe(supabaseServer, email);
      status = result.ok ? 'success' : 'error';
    }
  }

  return <UnsubscribeResult status={status} locale="pt" confirmFields={{ e, t }} />;
}
