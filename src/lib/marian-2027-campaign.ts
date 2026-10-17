import type { MarketingContact } from './marketing-core';
import { isDeliverableMarketingEmail, normalizeEmail } from './marketing-core';
import { APP_URL } from './config';

export const MARIAN_2027_SLUG = 'peregrinacao-mariana-2027';
export const MARIAN_2027_URL = `${APP_URL}/peregrinacoes/${MARIAN_2027_SLUG}`;

export const MARIAN_2027_STEPS = [
  // Fotografias que constam do itinerário publicado desta peregrinação.
  { key: 'marian_2027_invitation', label: '01 · O convite', day: 0, image: 'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200003184-285f1285f5/Hesed_apostoladodeGarabandal.webp?ph=7a8de8e761' },
  { key: 'marian_2027_journey', label: '02 · O itinerário', day: 7, image: 'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200003152-b6916b6919/IMG-20180719-WA0022.webp?ph=7a8de8e761' },
  { key: 'marian_2027_practical', label: '03 · Preparar a inscrição', day: 14, image: 'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200003146-c4b1ac4b1e/DSC_0665.webp?ph=7a8de8e761' },
] as const;

export type Marian2027StepKey = typeof MARIAN_2027_STEPS[number]['key'];

export const marian2027EmailContext = (stepKey: Marian2027StepKey) => ({
  pilgrimageName: 'Caminho Mariano 2027',
  pilgrimageDates: '11 a 24 de outubro de 2027',
  pilgrimageUrl: MARIAN_2027_URL,
  pilgrimageImageUrl: MARIAN_2027_STEPS.find((step) => step.key === stepKey)!.image,
});

type QueryClient = { from: (table: string) => any };
type Subscriber = { normalized_email: string; display_name: string | null; language: string; consent_state: string; external_status: string | null };

async function allRows<T>(makeQuery: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await makeQuery(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export function selectMarian2027Audience(
  subscribers: Subscriber[],
  excludedEmails: Set<string>,
  language: 'pt' | 'en' = 'pt',
): Array<Pick<MarketingContact, 'display_name' | 'normalized_email' | 'language' | 'recommendation'>> {
  const seen = new Set<string>();
  return subscribers.flatMap((subscriber) => {
    const email = normalizeEmail(subscriber.normalized_email);
    if (!email || !isDeliverableMarketingEmail(email) || seen.has(email) || excludedEmails.has(email)) return [];
    if (subscriber.consent_state !== 'explicit' || subscriber.language !== language) return [];
    if (subscriber.external_status && !['active', 'subscribed'].includes(subscriber.external_status.toLowerCase())) return [];
    seen.add(email);
    return [{
      normalized_email: email,
      display_name: subscriber.display_name?.trim() || '',
      language,
      recommendation: language === 'en' ? 'Marian Way 2027' : 'Caminho Mariano 2027',
    }];
  }).sort((a, b) => a.normalized_email!.localeCompare(b.normalized_email!));
}

export async function loadMarian2027Audience(supabase: QueryClient, language: 'pt' | 'en' = 'pt', cutoff?: string) {
  const { data: pilgrimage, error: pilgrimageError } = await supabase
    .from('pilgrimages')
    .select('id,status,current_vacancies,registration_deadline')
    .eq('slug', MARIAN_2027_SLUG)
    .single();
  if (pilgrimageError || !pilgrimage) throw pilgrimageError || new Error('Peregrinação não encontrada.');

  const [subscribers, bookings, suppressions, optedOutContacts] = await Promise.all([
    allRows<Subscriber>((start, end) => {
      let query = supabase.from('newsletter_subscribers')
        .select('normalized_email,display_name,language,consent_state,external_status')
        .eq('language', language).eq('consent_state', 'explicit');
      if (cutoff) query = query.lte('created_at', cutoff);
      return query.order('normalized_email').range(start, end);
    }),
    allRows<{ id: string; user_id: string | null }>((start, end) => supabase.from('bookings')
      .select('id,user_id').eq('pilgrimage_id', pilgrimage.id)
      .order('id').range(start, end)),
    allRows<{ normalized_email: string | null }>((start, end) => supabase.from('marketing_suppression_list')
      .select('normalized_email').not('normalized_email', 'is', null)
      .order('normalized_email').range(start, end)),
    allRows<{ normalized_email: string | null }>((start, end) => supabase.from('marketing_contacts')
      .select('normalized_email').in('consent_state', ['unsubscribed', 'suppressed'])
      .order('normalized_email').range(start, end)),
  ]);

  const excludedEmails = new Set<string>();
  for (const row of [...suppressions, ...optedOutContacts]) {
    const email = normalizeEmail(row.normalized_email);
    if (email) excludedEmails.add(email);
  }

  // A reserva exclui tanto o titular como todos os peregrinos associados.
  // Incluímos reservas de qualquer estado para errar pelo lado de não contactar.
  for (let index = 0; index < bookings.length; index += 100) {
    const chunk = bookings.slice(index, index + 100);
    const ids = chunk.map((row) => row.id);
    const userIds = [...new Set(chunk.map((row) => row.user_id).filter(Boolean))];
    const [pilgrimsResult, membersResult] = await Promise.all([
      supabase.from('pilgrims').select('email').in('booking_id', ids),
      userIds.length
        ? supabase.from('membros').select('email').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pilgrimsResult.error) throw pilgrimsResult.error;
    if (membersResult.error) throw membersResult.error;
    for (const row of [...(pilgrimsResult.data || []), ...(membersResult.data || [])]) {
      const email = normalizeEmail(row.email);
      if (email) excludedEmails.add(email);
    }
  }

  const audience = selectMarian2027Audience(subscribers, excludedEmails, language);
  const deadline = pilgrimage.registration_deadline ? new Date(pilgrimage.registration_deadline).getTime() : null;
  const sendable = ['open', 'active', 'ativo'].includes(String(pilgrimage.status).toLowerCase())
    && Number(pilgrimage.current_vacancies) > 0
    && (deadline === null || (Number.isFinite(deadline) && deadline >= Date.now()));

  return {
    audience,
    sendable,
    stats: {
      optedIn: subscribers.length,
      bookingRows: bookings.length,
      excludedEmails: excludedEmails.size,
      eligible: audience.length,
      status: pilgrimage.status,
      vacancies: pilgrimage.current_vacancies,
    },
  };
}
