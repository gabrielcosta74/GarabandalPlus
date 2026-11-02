const parseEnvInt = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

// Interruptor global: MARKETING_SENDING_PAUSED=1 para todos os envios de marketing
// (funis, campanhas, Marian, newsletter) sem mexer em código. Transacionais não param.
export const isMarketingSendingPaused = () => ['1', 'true', 'on'].includes(String(process.env.MARKETING_SENDING_PAUSED || '').toLowerCase());

export const getMarketingEmailLimits = () => ({
  minHoursBetweenEmails: parseEnvInt('MARKETING_MIN_HOURS_BETWEEN_EMAILS', 24, 12, 168),
  maxEmailsPer7Days: parseEnvInt('MARKETING_MAX_EMAILS_PER_7D', 7, 1, 7),
  cronBatchLimit: parseEnvInt('MARKETING_CRON_BATCH_LIMIT', 15, 1, 50),
  cronDailySendCap: parseEnvInt('MARKETING_CRON_DAILY_SEND_CAP', 50, 1, 500),
  enrollmentPrepareLimit: parseEnvInt('MARKETING_ENROLLMENT_PREPARE_LIMIT', 50, 1, 250),
  campaignAudienceLimit: parseEnvInt('MARKETING_CAMPAIGN_AUDIENCE_LIMIT', 100, 1, 500),
  // Parte do teto diário que as campanhas (Marian) não podem gastar: fica sempre
  // reservada aos funis (onboarding, recuperação, lista de espera...), que antes
  // ficavam 1–3 envios/dia atrás de uma campanha que consumia quase os 50.
  funnelReservedDailySends: parseEnvInt('MARKETING_FUNNEL_RESERVED_DAILY', 20, 0, 200),
});

// Quiet hours: emails de marketing só saem dentro da janela local do público
// (maioria Brasil). Fora da janela o cron não processa nada — os enrollments
// ficam devidos e saem na primeira corrida dentro da janela. Formato do env:
// MARKETING_SEND_WINDOW="9-20" (hora de início inclusive, fim exclusive). O fim às
// 20h de Brasília deixa os contactos em Portugal (+3/+4h) antes da meia-noite.
export const MARKETING_SEND_TIMEZONE = 'America/Sao_Paulo';

export const getMarketingSendWindow = () => {
  const raw = process.env.MARKETING_SEND_WINDOW || '9-20';
  const match = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  const start = match ? Math.min(23, Math.max(0, Number(match[1]))) : 9;
  const end = match ? Math.min(24, Math.max(start + 1, Number(match[2]))) : 20;
  return { start, end };
};

export const isWithinMarketingSendWindow = (now: Date = new Date()) => {
  const { start, end } = getMarketingSendWindow();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: MARKETING_SEND_TIMEZONE }).format(now),
  );
  return hour >= start && hour < end;
};

export const getMarketingWindowStarts = (
  now: Date = new Date(),
  limits = getMarketingEmailLimits(),
) => ({
  recent: new Date(now.getTime() - limits.minHoursBetweenEmails * 60 * 60 * 1000).toISOString(),
  day: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
});

export const countMarketingSendsForContact = async (
  supabase: any,
  contactId: string | null | undefined,
  now: Date = new Date(),
  limits = getMarketingEmailLimits(),
) => {
  if (!contactId) return { recent: 0, week: 0 };

  const windows = getMarketingWindowStarts(now, limits);
  const [recent, week] = await Promise.all([
    supabase
      .from('marketing_message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId)
      .eq('status', 'sent')
      .gte('created_at', windows.recent),
    supabase
      .from('marketing_message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId)
      .eq('status', 'sent')
      .gte('created_at', windows.week),
  ]);

  if (recent.error) throw recent.error;
  if (week.error) throw week.error;

  return {
    recent: recent.count || 0,
    week: week.count || 0,
  };
};

export const countMarketingSendsSince = async (supabase: any, sinceIso: string) => {
  const { count, error } = await supabase
    .from('marketing_message_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', sinceIso);

  if (error) throw error;
  return count || 0;
};
