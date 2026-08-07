import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/auth-utils';
import { loadUserPaymentAlerts } from '../../../../lib/pilgrimage-payment-alerts.server';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível.' },
      { status: 503 },
    );
  }

  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'pt';

  try {
    const alerts = await loadUserPaymentAlerts(supabaseServer, {
      userId: user.id,
      locale,
    });

    return NextResponse.json(
      { alerts, generatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[API Booking Payment Alerts] Failed to load alerts:', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar os avisos de pagamento.' },
      { status: 502 },
    );
  }
}
