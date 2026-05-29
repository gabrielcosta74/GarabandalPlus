import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendAuctionOutbidEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';

/**
 * POST /api/auction/bid
 * Place a bid on an auction item.
 * Body: { item_id: string, amount: number (in cents) }
 */
export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Authenticate user
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!bearerToken) {
        return NextResponse.json({ error: 'Autenticação necessária para licitar.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseServer.auth.getUser(bearerToken);
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }

    const user = authData.user;

    // 2. Check if user is banned from auction (membros.id == auth.users.id)
    const { data: memberData } = await supabaseServer
        .from('membros')
        .select('banned_from_auction')
        .eq('id', user.id)
        .maybeSingle();

    if (memberData?.banned_from_auction) {
        return NextResponse.json({
            error: 'A sua conta está impedida de licitar devido a um pagamento anterior não concluído.'
        }, { status: 403 });
    }

    // 3. Parse and validate body
    let body: { item_id?: string; amount?: number };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { item_id, amount } = body;

    if (!item_id || !amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'item_id e amount são obrigatórios.' }, { status: 400 });
    }

    // 4. Fetch the auction item
    const { data: item, error: itemError } = await supabaseServer
        .from('auction_items')
        .select('*')
        .eq('id', item_id)
        .single();

    if (itemError || !item) {
        return NextResponse.json({ error: 'Item de leilão não encontrado.' }, { status: 404 });
    }

    // 5. Validate auction state
    if (item.status !== 'active') {
        return NextResponse.json({ error: 'Este leilão não está ativo.' }, { status: 400 });
    }

    if (new Date(item.ends_at) <= new Date()) {
        return NextResponse.json({ error: 'Este leilão já terminou.' }, { status: 400 });
    }

    // 6. Validate bid amount
    const previousBidderId = item.current_bidder_id;
    const previousBid = item.current_bid;

    if (item.current_bid) {
        const minBid = item.current_bid + (item.min_increment || 100);
        if (amount < minBid) {
            return NextResponse.json({
                error: `O lance mínimo é ${(minBid / 100).toFixed(2)}€.`,
                min_bid: minBid
            }, { status: 400 });
        }
    } else {
        if (amount < item.starting_price) {
            return NextResponse.json({
                error: `O lance mínimo é ${(item.starting_price / 100).toFixed(2)}€.`,
                min_bid: item.starting_price
            }, { status: 400 });
        }
    }

    // 7. Prevent bidding against yourself
    if (item.current_bidder_id === user.id) {
        return NextResponse.json({ error: 'Já tem o lance mais alto neste item.' }, { status: 400 });
    }

    // 8. Insert bid and update item atomically
    const { error: bidError } = await supabaseServer
        .from('auction_bids')
        .insert({
            item_id,
            user_id: user.id,
            user_email: user.email || '',
            amount
        });

    if (bidError) {
        console.error('[Auction] Bid insert error:', bidError);
        return NextResponse.json({ error: 'Erro ao registar o lance.' }, { status: 500 });
    }

    const { error: updateError } = await supabaseServer
        .from('auction_items')
        .update({
            current_bid: amount,
            current_bidder_id: user.id,
            total_bids: (item.total_bids || 0) + 1,
            updated_at: new Date().toISOString()
        })
        .eq('id', item_id);

    if (updateError) {
        console.error('[Auction] Item update error:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar o leilão.' }, { status: 500 });
    }

    // 9. Notify the previous bidder that they were outbid (fire-and-forget)
    if (previousBidderId && previousBidderId !== user.id && previousBid) {
        const { data: prevUser } = await supabaseServer.auth.admin.getUserById(previousBidderId);
        const prevEmail = prevUser?.user?.email;

        if (prevEmail) {
            const appUrl = getAppUrl() || 'https://apostoladodegarabandal.com';

            // Pick locale from the recipient's country (no stored locale preference).
            // Portuguese-speaking countries → PT, everyone else → EN.
            const { data: prevMember } = await supabaseServer
                .from('membros')
                .select('country')
                .eq('id', previousBidderId)
                .maybeSingle();
            const ptCountries = ['portugal', 'pt', 'brasil', 'brazil', 'br'];
            const country = (prevMember?.country || '').trim().toLowerCase();
            const locale: 'pt' | 'en' = country && !ptCountries.includes(country) ? 'en' : 'pt';

            sendAuctionOutbidEmail({
                email: prevEmail,
                itemTitle: item.title || 'Peça de Leilão',
                yourBid: previousBid / 100,
                newBid: amount / 100,
                minIncrement: (item.min_increment || 100) / 100,
                itemUrl: `${appUrl}/leilao/${item_id}`,
                locale,
            }).catch(err => console.error('[Auction] Outbid email error:', err));
        }
    }

    return NextResponse.json({
        success: true,
        bid: {
            amount,
            item_id,
            total_bids: (item.total_bids || 0) + 1
        }
    });
}

