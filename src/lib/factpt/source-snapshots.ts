import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseServiceClient = Pick<SupabaseClient, 'from' | 'auth'>;

export type FactPtSourceType = 'quota' | 'store' | 'donation' | 'pilgrimage';
export type FactPtCredentialAlias = 'Q' | 'L' | 'D';
export type FactPtItemType = 'product' | 'service' | 'other';

export type FactPtSourceCustomer = {
  userId: string | null;
  name: string;
  email: string;
  nif: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
};

export type FactPtSourceItem = {
  reference: string;
  description: string;
  price: number;
  quantity: number;
  discount?: number;
  taxRate: number;
  type: FactPtItemType;
};

export type FactPtSourceSnapshot = {
  sourceType: FactPtSourceType;
  sourceTable: string;
  sourceId: string;
  sourceReference: string;
  credentialAlias: FactPtCredentialAlias;
  seriesCode: '2026Q' | '2026L' | '2026D';
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  customer: FactPtSourceCustomer;
  items: FactPtSourceItem[];
  comments: string | null;
  language: 'pt' | 'en';
  emailSourceLabel?: string;
};

const clean = (value: unknown): string | null => {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
};

const normalizeNif = (value: unknown): string | null => {
  const result = String(value || '').replace(/\D/g, '');
  return result || null;
};

const requireEmail = (value: unknown, sourceType: FactPtSourceType): string => {
  const email = clean(value)?.toLowerCase() || '';
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email === 'anonimo@garabandal.pt'
    || email.endsWith('@chat.local')
  ) {
    throw new Error(`Email real obrigatório para faturar ${sourceType}.`);
  }
  return email;
};

const requirePositiveAmount = (value: unknown, sourceType: FactPtSourceType): number => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Montante inválido para faturar ${sourceType}.`);
  }
  return Math.round(amount * 100) / 100;
};

const toPaymentDate = (...values: unknown[]): string => {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
};

const normalizeTaxRate = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric > 0 && numeric < 1 ? numeric * 100 : numeric;
};

const FACTPT_DONATION_ITEM_REFERENCE = 'AAG-003';
const FACTPT_DONATION_ITEM_DESCRIPTION =
  'Doação - Associação do Apostolado de Garabandal';

const paymentKindFromNotes = (notes: unknown): string => {
  const match = /Tipo:\s*([a-z_]+)/i.exec(String(notes || ''));
  switch (match?.[1]?.toLowerCase()) {
    case 'deposit': return 'Sinal';
    case 'full': return 'Pagamento total';
    case 'installment': return 'Prestação';
    case 'balance': return 'Valor restante';
    default: return 'Prestação';
  }
};

const fiscalPilgrimageTitle = (value: unknown): string => {
  const title = clean(value) || 'Peregrinação';
  return title
    .replace(/^\[TESTE PRIVADO FACT\.pt\]\s*/i, '')
    .trim() || 'Peregrinação';
};

const loadMember = async (supabase: SupabaseServiceClient, userId: string | null) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('membros')
    .select('id, nome, email, nif, address, postal_code, city, country, telefone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const loadAuthEmail = async (supabase: SupabaseServiceClient, userId: string | null) => {
  if (!userId) return null;
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user?.email || null;
};

const loadDonationSnapshot = async (
  supabase: SupabaseServiceClient,
  sourceId: string,
): Promise<FactPtSourceSnapshot> => {
  const { data: donation, error } = await supabase
    .from('donations')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!donation) throw new Error('Donativo não encontrado.');

  const metadata = donation.metadata && typeof donation.metadata === 'object'
    ? donation.metadata
    : {};
  const amount = requirePositiveAmount(
    typeof donation.amount_cents === 'number' ? donation.amount_cents / 100 : donation.amount,
    'donation',
  );
  const email = requireEmail(donation.donor_email, 'donation');

  return {
    sourceType: 'donation',
    sourceTable: 'donations',
    sourceId,
    sourceReference: clean(donation.external_reference) || `DON-${sourceId.slice(0, 8)}`,
    credentialAlias: 'D',
    seriesCode: '2026D',
    amount,
    currency: clean(donation.currency) || 'EUR',
    paymentMethod: clean(metadata.reduniq_method)
      || clean(metadata.payment_option_id)
      || clean(metadata.paymentMethod)
      || clean(donation.method)
      || 'reduniq',
    paymentDate: toPaymentDate(donation.confirmed_at, donation.updated_at, donation.created_at),
    customer: {
      userId: clean(donation.user_id),
      name: clean(donation.donor_name) || 'Doador',
      email,
      nif: normalizeNif(donation.donor_nif),
      address: clean(donation.donor_address),
      zip: clean(donation.donor_zip),
      city: clean(donation.donor_city),
      country: clean(donation.donor_country),
      phone: clean(donation.donor_phone),
    },
    items: [{
      reference: FACTPT_DONATION_ITEM_REFERENCE,
      description: FACTPT_DONATION_ITEM_DESCRIPTION,
      price: amount,
      quantity: 1,
      taxRate: 0,
      type: 'other',
    }],
    comments: 'Doação sem contrapartidas',
    language: metadata.locale === 'en' ? 'en' : 'pt',
    emailSourceLabel: FACTPT_DONATION_ITEM_DESCRIPTION,
  };
};

const loadQuotaSnapshot = async (
  supabase: SupabaseServiceClient,
  sourceId: string,
  requestedType: FactPtSourceType,
): Promise<FactPtSourceSnapshot> => {
  const { data: payment, error } = await supabase
    .from('pagamentos_quotas')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error('Pagamento de quota não encontrado.');

  const sourceType: FactPtSourceType = requestedType === 'donation'
    || String(payment.notes || '').includes('[TYPE:DONATION]')
    ? 'donation'
    : 'quota';
  const userId = clean(payment.user_id);
  const member = await loadMember(supabase, userId);
  const authEmail = await loadAuthEmail(supabase, userId);
  const amount = requirePositiveAmount(payment.valor, sourceType);
  const year = String(payment.data_pagamento || '').slice(0, 4);
  const isDonation = sourceType === 'donation';

  return {
    sourceType,
    sourceTable: 'pagamentos_quotas',
    sourceId,
    sourceReference: clean(payment.external_reference)
      || `${isDonation ? 'DON' : 'QUOTA'}-${sourceId.slice(0, 8)}`,
    credentialAlias: isDonation ? 'D' : 'Q',
    seriesCode: isDonation ? '2026D' : '2026Q',
    amount,
    currency: 'EUR',
    paymentMethod: clean(payment.metodo_pagamento) || 'reduniq',
    paymentDate: toPaymentDate(payment.data_pagamento, payment.created_at),
    customer: {
      userId,
      name: clean(member?.nome) || 'Membro',
      email: requireEmail(member?.email || authEmail, sourceType),
      nif: normalizeNif(member?.nif),
      address: clean(member?.address),
      zip: clean(member?.postal_code),
      city: clean(member?.city),
      country: clean(member?.country),
      phone: clean(member?.telefone),
    },
    items: [{
      reference: isDonation ? FACTPT_DONATION_ITEM_REFERENCE : 'QUOTA',
      description: isDonation
        ? FACTPT_DONATION_ITEM_DESCRIPTION
        : `Quota de membro${/^\d{4}$/.test(year) ? ` ${year}` : ''}`,
      price: amount,
      quantity: 1,
      taxRate: 0,
      type: isDonation ? 'other' : 'service',
    }],
    comments: isDonation ? 'Doação sem contrapartidas' : null,
    language: String(payment.notes || '').includes('[locale:en]') ? 'en' : 'pt',
    emailSourceLabel: isDonation ? FACTPT_DONATION_ITEM_DESCRIPTION : undefined,
  };
};

const loadStoreSnapshot = async (
  supabase: SupabaseServiceClient,
  sourceId: string,
): Promise<FactPtSourceSnapshot> => {
  const { data: order, error } = await supabase
    .from('store_orders')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error('Encomenda não encontrada.');

  const { data: rows, error: itemError } = await supabase
    .from('store_order_items')
    .select('product_id, sku, name, qty, unit_price, total_price, tax_rate, item_type')
    .eq('order_ref', order.order_ref);
  if (itemError) throw itemError;
  if (!rows?.length) throw new Error('Encomenda sem linhas para faturar.');

  const productIds = rows.map((row) => row.product_id).filter(Boolean);
  const { data: products, error: productError } = productIds.length
    ? await supabase
      .from('store_products')
      .select('product_id, sku, is_physical')
      .in('product_id', productIds)
    : { data: [], error: null };
  if (productError) throw productError;
  const productMap = new Map(
    (products || []).map((product) => [String(product.product_id), product]),
  );

  const items: FactPtSourceItem[] = rows.map((row) => {
    const product = productMap.get(String(row.product_id));
    const isPhysical = row.item_type
      ? row.item_type === 'product'
      : product?.is_physical !== false;
    return {
      reference: clean(row.sku) || clean(product?.sku) || `PROD-${String(row.product_id).slice(0, 12)}`,
      description: clean(row.name) || 'Produto',
      price: Number(row.unit_price || 0),
      quantity: Number(row.qty || 1),
      taxRate: normalizeTaxRate(row.tax_rate, isPhysical ? 6 : 23),
      type: isPhysical ? 'product' : 'service',
    };
  });

  const shippingCost = Number(order.shipping_cost || 0);
  if (shippingCost > 0) {
    items.push({
      reference: 'PORTES',
      description: 'Portes de envio',
      price: shippingCost,
      quantity: 1,
      taxRate: 6,
      type: 'service',
    });
  }

  const amount = requirePositiveAmount(order.total_amount, 'store');
  const gross = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountValue = Math.max(0, gross - amount);
  if (discountValue > 0 && gross > 0) {
    const discountPercent = Math.min(100, (discountValue / gross) * 100);
    items.forEach((item) => {
      item.discount = discountPercent;
    });
  }

  return {
    sourceType: 'store',
    sourceTable: 'store_orders',
    sourceId,
    sourceReference: clean(order.order_ref) || `SHOP-${sourceId.slice(0, 8)}`,
    credentialAlias: 'L',
    seriesCode: '2026L',
    amount,
    currency: clean(order.currency) || 'EUR',
    paymentMethod: clean(order.payment_method) || clean(order.payment_provider) || 'reduniq',
    paymentDate: toPaymentDate(order.paid_at, order.updated_at, order.created_at),
    customer: {
      userId: clean(order.buyer_user_id),
      name: clean(order.buyer_name) || 'Cliente da loja',
      email: requireEmail(order.buyer_email, 'store'),
      nif: normalizeNif(order.buyer_nif),
      address: clean(order.billing_address) || clean(order.shipping_address1),
      zip: clean(order.billing_postal_code) || clean(order.shipping_postal_code),
      city: clean(order.billing_city) || clean(order.shipping_city),
      country: clean(order.billing_country) || clean(order.shipping_country),
      phone: clean(order.buyer_phone),
    },
    items,
    comments: null,
    language: clean(order.locale) === 'en' ? 'en' : 'pt',
  };
};

const loadPilgrimageSnapshot = async (
  supabase: SupabaseServiceClient,
  sourceId: string,
): Promise<FactPtSourceSnapshot> => {
  const { data: payment, error } = await supabase
    .from('pilgrimage_payments')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error('Pagamento de peregrinação não encontrado.');

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, pilgrimage_id, notes, pilgrimages(title, start_date)')
    .eq('id', payment.booking_id)
    .maybeSingle();
  if (bookingError) throw bookingError;
  if (!booking) throw new Error('Reserva da peregrinação não encontrada.');

  // The booking account holder is always the fiscal customer and email recipient.
  const accountHolderId = clean(booking.user_id);
  const member = await loadMember(supabase, accountHolderId);
  const authEmail = await loadAuthEmail(supabase, accountHolderId);
  const holderEmail = requireEmail(authEmail || member?.email, 'pilgrimage');

  const { data: pilgrims, error: pilgrimError } = await supabase
    .from('pilgrims')
    .select('full_name, email, phone, cpf_nif, address, postal_code, city, country, created_at')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: true });
  if (pilgrimError) throw pilgrimError;

  const accountPilgrim = (pilgrims || []).find(
    (pilgrim) => clean(pilgrim.email)?.toLowerCase() === holderEmail,
  ) || null;
  const trip = Array.isArray(booking.pilgrimages)
    ? booking.pilgrimages[0]
    : booking.pilgrimages;
  // The private-pilot marker is an internal access-control detail and must
  // never be printed on the official fiscal document.
  const tripTitle = fiscalPilgrimageTitle(trip?.title);
  const kind = paymentKindFromNotes(payment.notes);
  // `amount` is only the principal credited to the booking. Reduniq payments
  // invoice the gross amount actually collected from the account holder.
  const amount = requirePositiveAmount(
    String(payment.method || '').startsWith('reduniq_')
      ? payment.charged_amount ?? payment.amount
      : payment.amount,
    'pilgrimage',
  );

  return {
    sourceType: 'pilgrimage',
    sourceTable: 'pilgrimage_payments',
    sourceId,
    sourceReference: clean(payment.external_reference) || `PILG-${sourceId.slice(0, 8)}`,
    credentialAlias: 'D',
    seriesCode: '2026D',
    amount,
    currency: 'EUR',
    paymentMethod: clean(payment.method) || 'reduniq',
    paymentDate: toPaymentDate(payment.verified_at, payment.updated_at, payment.created_at),
    customer: {
      userId: accountHolderId,
      name: clean(member?.nome) || clean(accountPilgrim?.full_name) || 'Responsável da reserva',
      email: holderEmail,
      nif: normalizeNif(member?.nif) || normalizeNif(accountPilgrim?.cpf_nif),
      address: clean(member?.address) || clean(accountPilgrim?.address),
      zip: clean(member?.postal_code) || clean(accountPilgrim?.postal_code),
      city: clean(member?.city) || clean(accountPilgrim?.city),
      country: clean(member?.country) || clean(accountPilgrim?.country),
      phone: clean(member?.telefone) || clean(accountPilgrim?.phone),
    },
    items: [{
      reference: FACTPT_DONATION_ITEM_REFERENCE,
      description: FACTPT_DONATION_ITEM_DESCRIPTION,
      price: amount,
      quantity: 1,
      taxRate: 0,
      type: 'other',
    }],
    comments: 'Doação sem contrapartidas',
    language: String(booking.notes || '').includes('[locale:en]') ? 'en' : 'pt',
    emailSourceLabel: `${tripTitle} — ${kind}`,
  };
};

export const loadFactPtSourceSnapshot = async (
  supabase: SupabaseServiceClient,
  sourceType: FactPtSourceType,
  sourceId: string,
  sourceTable?: string,
): Promise<FactPtSourceSnapshot> => {
  switch (sourceType) {
    case 'donation': {
      if (sourceTable === 'pagamentos_quotas') {
        return loadQuotaSnapshot(supabase, sourceId, sourceType);
      }
      if (sourceTable === 'donations') {
        return loadDonationSnapshot(supabase, sourceId);
      }
      const { data } = await supabase
        .from('factpt_documents')
        .select('source_table')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.source_table === 'pagamentos_quotas'
        ? loadQuotaSnapshot(supabase, sourceId, sourceType)
        : loadDonationSnapshot(supabase, sourceId);
    }
    case 'quota':
      return loadQuotaSnapshot(supabase, sourceId, sourceType);
    case 'store':
      return loadStoreSnapshot(supabase, sourceId);
    case 'pilgrimage':
      return loadPilgrimageSnapshot(supabase, sourceId);
  }
};
