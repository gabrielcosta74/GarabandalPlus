import { NextResponse } from 'next/server';
import { buildMarketingContacts } from '../../../../../../lib/marketing-data';
import { sendAuctionAnnouncementEmail } from '../../../../../../lib/email';
import { jsonError, requireMarketingAdmin } from '../../../../../../lib/marketing-api';
import { countMarketingSendsForContact, getMarketingEmailLimits } from '../../../../../../lib/marketing-limits';
import { getAppUrl } from '../../../../../../lib/config';

export const dynamic = 'force-dynamic';

const persistContactForLog = async (supabase: any, contact: any) => {
    if (!contact.normalized_email) return null;
    const { data } = await supabase
        .from('marketing_contacts')
        .upsert(
            {
                normalized_email: contact.normalized_email,
                normalized_phone: contact.normalized_phone,
                display_name: contact.display_name,
                country: contact.country,
                language: contact.language,
                consent_state: contact.consent_state,
                source_summary: contact.source_summary,
                latest_activity_at: contact.latest_activity_at,
                lead_score: contact.lead_score,
                lifecycle_stage: contact.lifecycle_stage,
                recommendation: contact.recommendation,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'normalized_email' },
        )
        .select('id')
        .single();
    return data?.id || null;
};

/**
 * POST /api/admin/auction/[id]/announce
 * Broadcasts a "new auction" email to consenting contacts (members + leads).
 * Body: { dryRun?: boolean (default true), force?: boolean }
 * dryRun returns the eligible audience count without sending.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireMarketingAdmin(req);
    if (!auth.ok) return auth.response;

    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const dryRun = body?.dryRun !== false; // default: preview only
        const force = body?.force === true;
        const limits = getMarketingEmailLimits();

        const { data: item, error: itemError } = await auth.supabase
            .from('auction_items')
            .select('id, title, description, images, current_bid, starting_price, ends_at, status, announced_at')
            .eq('id', id)
            .single();

        if (itemError || !item) {
            return NextResponse.json({ error: 'Leilão não encontrado.' }, { status: 404 });
        }
        if (item.status !== 'active') {
            return NextResponse.json({ error: 'Só é possível anunciar leilões ativos.' }, { status: 400 });
        }
        if (item.announced_at && !force && !dryRun) {
            return NextResponse.json({
                error: 'Este leilão já foi anunciado. Confirme novamente para reenviar.',
                alreadyAnnounced: true,
                announcedAt: item.announced_at,
            }, { status: 409 });
        }

        const appUrl = getAppUrl() || 'https://apostoladodegarabandal.com';
        const itemUrl = `${appUrl}/leilao/${item.id}`;
        const imageUrl = Array.isArray(item.images) && item.images[0] ? item.images[0] : null;

        const contacts = (await buildMarketingContacts(auth.supabase))
            .filter((c) => c.normalized_email && c.consent_state !== 'suppressed')
            .slice(0, limits.campaignAudienceLimit);

        if (dryRun) {
            return NextResponse.json({
                dryRun: true,
                eligible: contacts.length,
                alreadyAnnounced: !!item.announced_at,
                announcedAt: item.announced_at,
                limits,
                sample: contacts.slice(0, 10).map((c) => ({ name: c.display_name, email: c.normalized_email })),
            });
        }

        const results: Array<{ email: string; sent: boolean; skipped?: boolean; reason?: string; error?: string | null }> = [];

        for (const contact of contacts) {
            const email = contact.normalized_email;
            if (!email) continue;
            const contactId = await persistContactForLog(auth.supabase, contact);
            const sendCounts = await countMarketingSendsForContact(auth.supabase, contactId, new Date(), limits);

            if (sendCounts.recent >= 1 || sendCounts.week >= limits.maxEmailsPer7Days) {
                await auth.supabase.from('marketing_message_logs').insert({
                    contact_id: contactId,
                    channel: 'email',
                    to_email: email,
                    subject: `Leilão: ${item.title}`,
                    template_key: 'auction_announcement',
                    status: 'skipped',
                    error_message: `Limite de frequência (${limits.minHoursBetweenEmails}h / ${limits.maxEmailsPer7Days} por 7 dias).`,
                    metadata: { reason: 'rate_limited', auctionItemId: item.id },
                });
                results.push({ email, sent: false, skipped: true, reason: 'rate_limited' });
                continue;
            }

            const result = await sendAuctionAnnouncementEmail({
                toEmail: email,
                recipientName: contact.display_name,
                itemTitle: item.title,
                itemDescription: item.description,
                imageUrl,
                currentBid: item.current_bid,
                startingPrice: item.starting_price,
                endsAt: item.ends_at,
                itemUrl,
                locale: contact.language === 'en' ? 'en' : 'pt',
            });

            await auth.supabase.from('marketing_message_logs').insert({
                contact_id: contactId,
                channel: 'email',
                to_email: email,
                provider_message_id: result.providerId || null,
                subject: `Leilão: ${item.title}`,
                template_key: 'auction_announcement',
                status: result.sent ? 'sent' : 'failed',
                error_message: result.sent ? null : result.error,
                sent_at: result.sent ? new Date().toISOString() : null,
                metadata: { auctionItemId: item.id },
            });

            results.push({ email, sent: result.sent, error: result.error || null });
        }

        await auth.supabase
            .from('auction_items')
            .update({ announced_at: new Date().toISOString() })
            .eq('id', item.id);

        return NextResponse.json({
            success: true,
            processed: results.length,
            sent: results.filter((r) => r.sent).length,
            failed: results.filter((r) => r.error).length,
            skipped: results.filter((r) => r.skipped).length,
        });
    } catch (error) {
        return jsonError(error, 'Não foi possível anunciar o leilão.');
    }
}
