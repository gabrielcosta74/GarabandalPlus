import {
  fiscalBillingMissingFields,
  normalizeFiscalBilling,
  type FiscalBillingDetails,
  type FiscalBillingInput,
} from './fiscal-billing';

type SupabaseLike = {
  from: (table: string) => any;
};

type BookingBillingSource = {
  id: string;
  user_id: string;
  pilgrims?: Array<Record<string, unknown>> | null;
};

const clean = (value: unknown) => String(value ?? '').trim();
const normalizeEmail = (value: unknown) => clean(value).toLowerCase();

const loadMember = async (supabase: SupabaseLike, userId: string) => {
  const { data, error } = await supabase
    .from('membros')
    .select('id,nome,email,address,postal_code,city,country,nif')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o perfil de faturação: ${error.message}`);
  }
  return data as Record<string, unknown> | null;
};

const loadPilgrims = async (
  supabase: SupabaseLike,
  booking: BookingBillingSource,
) => {
  if (Array.isArray(booking.pilgrims) && booking.pilgrims.length > 0) {
    return booking.pilgrims;
  }

  const { data, error } = await supabase
    .from('pilgrims')
    .select('id,full_name,email,address,postal_code,city,country,cpf_nif,created_at')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar o titular da reserva: ${error.message}`);
  }
  return (data || []) as Array<Record<string, unknown>>;
};

const findAccountHolderPilgrim = (
  pilgrims: Array<Record<string, unknown>>,
  member: Record<string, unknown> | null,
) => {
  const memberEmail = normalizeEmail(member?.email);
  if (memberEmail) {
    const matching = pilgrims.find(
      (pilgrim) => normalizeEmail(pilgrim.email) === memberEmail,
    );
    if (matching) return matching;
  }
  return pilgrims[0] || null;
};

const hasCompleteRegistrationBilling = (
  holder: Record<string, unknown> | null,
) => Boolean(
  clean(holder?.full_name)
  && clean(holder?.email)
  && clean(holder?.address)
  && clean(holder?.postal_code)
  && clean(holder?.city)
  && clean(holder?.country),
);

export const loadPilgrimageBillingProfile = async (
  supabase: SupabaseLike,
  booking: BookingBillingSource,
): Promise<FiscalBillingDetails> => {
  const [member, pilgrims] = await Promise.all([
    loadMember(supabase, booking.user_id),
    loadPilgrims(supabase, booking),
  ]);
  const holder = findAccountHolderPilgrim(pilgrims, member);
  const registrationBillingIsComplete = hasCompleteRegistrationBilling(holder);
  const nif = registrationBillingIsComplete
    ? clean(holder?.cpf_nif)
    : clean(holder?.cpf_nif) || clean(member?.nif);

  return normalizeFiscalBilling({
    name: clean(holder?.full_name) || clean(member?.nome),
    email: clean(holder?.email) || clean(member?.email),
    address: clean(holder?.address) || clean(member?.address),
    postalCode: clean(holder?.postal_code) || clean(member?.postal_code),
    city: clean(holder?.city) || clean(member?.city),
    country: clean(holder?.country) || clean(member?.country),
    taxIdRequested: Boolean(nif),
    nif,
  });
};

export const savePilgrimageBillingProfile = async (
  supabase: SupabaseLike,
  booking: BookingBillingSource,
  input: FiscalBillingInput,
): Promise<FiscalBillingDetails> => {
  const billing = normalizeFiscalBilling(input);
  const missing = fiscalBillingMissingFields(billing);
  if (missing.length > 0) {
    const error = new Error('Dados de faturação inválidos.');
    (error as Error & { fields?: string[] }).fields = missing;
    throw error;
  }

  const [member, pilgrims] = await Promise.all([
    loadMember(supabase, booking.user_id),
    loadPilgrims(supabase, booking),
  ]);
  const holder = findAccountHolderPilgrim(pilgrims, member);
  if (!holder?.id) {
    throw new Error('Não foi possível identificar o titular da reserva.');
  }

  const now = new Date().toISOString();
  const memberPayload = {
    nome: billing.name,
    email: billing.email,
    address: billing.address,
    postal_code: billing.postalCode,
    city: billing.city,
    country: billing.country,
    nif: billing.taxIdRequested ? billing.nif : null,
    updated_at: now,
  };
  const pilgrimPayload = {
    full_name: billing.name,
    email: billing.email,
    address: billing.address,
    postal_code: billing.postalCode,
    city: billing.city,
    country: billing.country,
    cpf_nif: billing.taxIdRequested ? billing.nif : null,
  };

  const [{ error: memberError }, { error: pilgrimError }] = await Promise.all([
    supabase.from('membros').update(memberPayload).eq('id', booking.user_id),
    supabase.from('pilgrims').update(pilgrimPayload).eq('id', holder.id),
  ]);

  if (memberError || pilgrimError) {
    throw new Error(
      memberError?.message
      || pilgrimError?.message
      || 'Não foi possível atualizar os dados de faturação.',
    );
  }

  return billing;
};

export const pilgrimageBillingSnapshot = (billing: FiscalBillingDetails) => ({
  billing_name: billing.name,
  billing_email: billing.email,
  billing_address: billing.address,
  billing_postal_code: billing.postalCode,
  billing_city: billing.city,
  billing_country: billing.country,
  billing_nif: billing.taxIdRequested ? billing.nif : null,
  billing_tax_id_requested: billing.taxIdRequested,
});
