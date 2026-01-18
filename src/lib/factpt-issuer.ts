import { resolveCountryMeta } from './country-utils';
import {
  downloadFactPtDocumentPdf,
  factptRequest,
  getFactPtConfig,
  FactPtClientInput,
  FactPtDocumentInput,
  FactPtSourceType,
} from './factpt';
import { supabaseServer } from './supabase';
import { sendFactPtAdminDocumentEmail, sendFactPtClientDocumentEmail } from './email';
import { ensureNotificationRecord, markNotificationSent } from './email-notifications';

type FactPtClientDraft = {
  userId?: string | null;
  name: string;
  email?: string | null;
  nif?: string | null;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone?: string | null;
};

type FactPtItemDraft = {
  referenceBase: string;
  description: string;
  price: number;
  quantity?: number;
  taxRate: number;
  type: 'product' | 'service' | 'other';
  unitId?: number;
  retention?: boolean;
};

type FactPtIssueInput = {
  sourceType: FactPtSourceType;
  sourceRef: string;
  paymentMethod?: string | null;
  issuedAt?: string;
  client: FactPtClientDraft;
  items: FactPtItemDraft[];
};

type FactPtDocumentRecord = {
  id: string;
  status: string;
  factpt_document_id: string | null;
  factpt_url: string | null;
};

type FactPtContact = {
  name?: string | null;
  email?: string | null;
  nif?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
};

const FACTPT_REFERENCE_TAX_MAP: Record<string, number> = {
  'AAG-001': 0,
  'AAG-003': 0,
  'AAG-004': 6,
  'AAG-005': 23,
  'AAG-006': 23,
  'AAG-007': 23,
};

const TAX_CACHE_TTL = 1000 * 60 * 15;
let cachedTaxes: { fetchedAt: number; items: Array<{ id: string; value: string }> } | null = null;

const normalizeCountry = (value?: string | null) => {
  if (!value) return '';
  const meta = resolveCountryMeta(value);
  return meta?.code ? meta.code.toLowerCase() : value.trim().slice(0, 2).toLowerCase();
};

const normalizeCity = (city: string | null | undefined, address: string) => {
  if (city && city.trim()) return city.trim();
  if (!address) return 'N/A';
  const parts = address.split(',');
  const tail = parts[parts.length - 1]?.trim();
  return tail || address.trim();
};

const sanitizeReference = (value: string) =>
  value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();

const sanitizeIdentifierId = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefixed = `aag-${cleaned || 'doc'}`;
  return prefixed.slice(0, 50);
};

const buildItemReference = (base: string, sourceRef: string, index: number) => {
  const baseSafe = sanitizeReference(base).replace(/-+/g, '-').slice(0, 8) || 'AAG';
  const suffixSafe = sanitizeReference(sourceRef).replace(/-+/g, '').slice(-6) || '000000';
  const indexSafe = String(index + 1);
  let reference = `${baseSafe}-${suffixSafe}${indexSafe}`;
  if (reference.length > 20) {
    reference = `${baseSafe.slice(0, 6)}${suffixSafe}${indexSafe}`.slice(0, 20);
  }
  return reference;
};

const resolveTaxRate = (referenceBase: string, fallbackRate: number) => {
  const normalized = sanitizeReference(referenceBase);
  return FACTPT_REFERENCE_TAX_MAP[normalized] ?? fallbackRate;
};

const loadTaxes = async (config: ReturnType<typeof getFactPtConfig>) => {
  if (!config) throw new Error('fact.pt nao configurado.');
  if (cachedTaxes && Date.now() - cachedTaxes.fetchedAt < TAX_CACHE_TTL) {
    return cachedTaxes.items;
  }
  const response = await factptRequest<{ data: Array<{ id: string; value: string }> }>(config, 'GET', '/taxes');
  const items = response?.data || [];
  cachedTaxes = { fetchedAt: Date.now(), items };
  return items;
};

const resolveTaxIdByRate = async (config: ReturnType<typeof getFactPtConfig>, rate: number) => {
  const items = await loadTaxes(config);
  const match = items.find((item) => {
    const parsed = Number.parseFloat(item.value);
    return Number.isFinite(parsed) && Math.abs(parsed - rate) < 0.001;
  });
  if (!match) {
    throw new Error(`Nao foi possivel encontrar taxa ${rate}% no fact.pt.`);
  }
  return match.id;
};

const resolvePaymentType = (method?: string | null) => {
  const normalized = (method || '').toLowerCase();
  if (!normalized) return 2;
  if (normalized.includes('stripe')) return 2;
  if (normalized.includes('mbway') || normalized.includes('_107')) return 9;
  if (normalized.includes('multibanco') || normalized.includes('_108')) return 8;
  if (normalized.includes('pix') || normalized.includes('_116')) return 9;
  if (normalized.includes('transfer')) return 11;
  return 9;
};

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const sendFactPtEmails = async (
  config: ReturnType<typeof getFactPtConfig>,
  input: FactPtIssueInput,
  documentId: string,
  documentUrl: string | null,
) => {
  if (!supabaseServer || !config) return;
  try {
    const attachmentBuffer = await downloadFactPtDocumentPdf(documentId, config);
    const attachments = [
      {
        filename: `fatura-${documentId}.pdf`,
        content: attachmentBuffer,
        contentType: 'application/pdf',
      },
    ];
    const emailRef = `factpt:${input.sourceType}:${input.sourceRef}`;
    const clientEmail = input.client.email;
    const recipientName = input.client.name || null;
    if (clientEmail) {
      const notification = await ensureNotificationRecord(supabaseServer, {
        type: 'factpt_doc_client',
        reference: emailRef,
        userId: input.client.userId ?? null,
        email: clientEmail,
      });
      if (notification.shouldSend) {
        const sent = await sendFactPtClientDocumentEmail({
          toEmail: clientEmail,
          recipientName,
          documentId,
          documentUrl,
          sourceType: input.sourceType,
          sourceRef: input.sourceRef,
          attachments,
        });
        if (sent) {
          await markNotificationSent(supabaseServer, notification.recordId);
        }
      }
    }

    const adminNotification = await ensureNotificationRecord(supabaseServer, {
      type: 'factpt_doc_admin',
      reference: emailRef,
      email: null,
    });
    if (adminNotification.shouldSend) {
      const sent = await sendFactPtAdminDocumentEmail({
        recipientName,
        documentId,
        documentUrl,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        attachments,
      });
      if (sent) {
        await markNotificationSent(supabaseServer, adminNotification.recordId);
      }
    }
  } catch (err) {
    console.warn('Nao foi possivel enviar email com documento fact.pt:', err);
  }
};

const resolveFactPtClient = async (
  client: FactPtClientDraft,
  config: ReturnType<typeof getFactPtConfig>,
) => {
  if (!supabaseServer) {
    throw new Error('Supabase nao configurado.');
  }

  const email = client.email?.trim().toLowerCase() || null;
  const nif = client.nif ? client.nif.replace(/\D/g, '').trim() : null;

  let query = supabaseServer
    .from('factpt_clients')
    .select('factpt_client_id')
    .limit(1);

  if (client.userId) {
    query = query.eq('user_id', client.userId);
  } else if (nif) {
    query = query.eq('nif', nif);
  } else if (email) {
    query = query.eq('email', email);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing?.factpt_client_id) {
    return existing.factpt_client_id;
  }

  if (!config) {
    throw new Error('fact.pt nao configurado.');
  }

  const finalConsumer = !nif;
  const payload: FactPtClientInput = {
    name: client.name.trim().slice(0, 100),
    address: client.address.trim().slice(0, 100),
    zip: client.zip.trim(),
    city: normalizeCity(client.city, client.address).slice(0, 50),
    country: normalizeCountry(client.country),
    email: email || undefined,
    phone: client.phone || undefined,
    finalConsumer,
  };

  if (!finalConsumer) {
    payload.tin = Number(nif);
    payload.ric = false;
    payload.retention = false;
  }

  let response: { data?: { id: string } } | null = null;
  try {
    response = await factptRequest<{ data?: { id: string } }>(
      config,
      'POST',
      '/clients',
      { client: payload },
    );
  } catch (err: any) {
    const message = err?.message || '';
    if (!finalConsumer && message.includes('tinUnique')) {
      const retryPayload = { ...payload, forceTin: true };
      response = await factptRequest<{ data?: { id: string } }>(
        config,
        'POST',
        '/clients',
        { client: retryPayload },
      );
    } else {
      throw err;
    }
  }
  const factptClientId = response?.data?.id;
  if (!factptClientId) {
    throw new Error('fact.pt nao retornou o id do cliente.');
  }

  const conflictTarget = client.userId ? 'user_id' : nif ? 'nif' : email ? 'email' : null;
  if (conflictTarget) {
    await supabaseServer.from('factpt_clients').upsert(
      {
        user_id: client.userId ?? null,
        name: client.name || null,
        email: email,
        nif,
        country: client.country || null,
        factpt_client_id: factptClientId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: conflictTarget },
    );
  } else {
    await supabaseServer.from('factpt_clients').insert({
      user_id: client.userId ?? null,
      name: client.name || null,
      email: email,
      nif,
      country: client.country || null,
      factpt_client_id: factptClientId,
      updated_at: new Date().toISOString(),
    });
  }

  return factptClientId;
};

const buildClientDraft = (contact: FactPtContact, fallback: FactPtContact): FactPtClientDraft => {
  const name = contact.name || fallback.name || 'Cliente';
  const address = contact.address || fallback.address || '';
  const city = contact.city || fallback.city || '';
  const zip = contact.zip || fallback.zip || '';
  const country = contact.country || fallback.country || '';
  return {
    name,
    email: contact.email || fallback.email || null,
    nif: contact.nif || fallback.nif || null,
    address,
    city,
    zip,
    country,
    phone: contact.phone || fallback.phone || null,
  };
};

export const buildDonationInvoiceInput = async (params: {
  sourceRef: string;
  amount: number;
  paymentMethod?: string | null;
  userId?: string | null;
  donor: FactPtContact;
}): Promise<FactPtIssueInput | null> => {
  if (!supabaseServer) return null;
  const member = params.userId
    ? await supabaseServer
      .from('membros')
      .select('nome, email, address, postal_code, country, nif, telefone')
      .eq('id', params.userId)
      .maybeSingle()
      .then(({ data }) => data)
    : null;

  const fallback: FactPtContact = {
    name: member?.nome ?? null,
    email: member?.email ?? null,
    nif: member?.nif ?? null,
    address: member?.address ?? null,
    city: member?.address ?? null,
    zip: member?.postal_code ?? null,
    country: member?.country ?? null,
    phone: member?.telefone ?? null,
  };

  const client = buildClientDraft(params.donor, fallback);

  return {
    sourceType: 'donation',
    sourceRef: params.sourceRef,
    paymentMethod: params.paymentMethod,
    issuedAt: formatISODate(new Date()),
    client: {
      ...client,
      userId: params.userId ?? null,
    },
    items: [
      {
        referenceBase: 'AAG-003',
        description: 'Doacao para Associacao do Apostolado de Garabandal',
        price: params.amount,
        taxRate: 0,
        type: 'service',
        unitId: 1,
      },
    ],
  };
};

export const buildMembershipInvoiceInput = async (params: {
  sourceRef: string;
  amount: number;
  paymentMethod?: string | null;
  userId: string;
}): Promise<FactPtIssueInput | null> => {
  if (!supabaseServer) return null;
  const { data: member } = await supabaseServer
    .from('membros')
    .select('nome, email, address, postal_code, country, nif, telefone')
    .eq('id', params.userId)
    .maybeSingle();

  if (!member) return null;

  const client = buildClientDraft(
    {
      name: member.nome ?? null,
      email: member.email ?? null,
      nif: member.nif ?? null,
      address: member.address ?? null,
      city: member.address ?? null,
      zip: member.postal_code ?? null,
      country: member.country ?? null,
      phone: member.telefone ?? null,
    },
    {},
  );

  return {
    sourceType: 'membership',
    sourceRef: params.sourceRef,
    paymentMethod: params.paymentMethod,
    issuedAt: formatISODate(new Date()),
    client: {
      ...client,
      userId: params.userId,
    },
    items: [
      {
        referenceBase: 'AAG-001',
        description: 'Pagamento de quota anual - membro associado do Apostolado de Garabandal',
        price: params.amount,
        taxRate: 0,
        type: 'service',
        unitId: 1,
      },
    ],
  };
};

export const buildStoreInvoiceInput = async (params: {
  orderRef: string;
  paymentMethod?: string | null;
}): Promise<FactPtIssueInput | null> => {
  if (!supabaseServer) return null;

  const { data: order } = await supabaseServer
    .from('store_orders')
    .select(
      'buyer_name, buyer_email, buyer_nif, buyer_phone, shipping_address1, shipping_city, shipping_postal_code, shipping_country',
    )
    .eq('order_ref', params.orderRef)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabaseServer
    .from('store_order_items')
    .select('product_id, name, qty, unit_price')
    .eq('order_ref', params.orderRef);

  if (!items?.length) return null;

  const productIds = items.map((item) => item.product_id);
  const { data: products } = await supabaseServer
    .from('store_products')
    .select('product_id, factpt_reference, sku, is_physical')
    .in('product_id', productIds);

  const productById = (products || []).reduce<Record<string, any>>((acc, product) => {
    acc[product.product_id] = product;
    return acc;
  }, {});

  const lineItems = items.map((item) => {
    const product = productById[item.product_id] || {};
    const referenceBase = product.factpt_reference || product.sku || '';
    if (!referenceBase) {
      throw new Error(`Produto ${item.product_id} sem referencia fact.pt.`);
    }
    const isPhysical = product.is_physical ?? true;
    const taxRate = resolveTaxRate(referenceBase, isPhysical ? 6 : 23);
    return {
      referenceBase,
      description: item.name,
      price: Number(item.unit_price || 0),
      quantity: Number(item.qty || 1),
      taxRate,
      type: isPhysical ? 'product' : 'service',
      unitId: 1,
    } as FactPtItemDraft;
  });

  const client = buildClientDraft(
    {
      name: order.buyer_name,
      email: order.buyer_email,
      nif: order.buyer_nif,
      address: order.shipping_address1,
      city: order.shipping_city,
      zip: order.shipping_postal_code,
      country: order.shipping_country,
      phone: order.buyer_phone,
    },
    {},
  );

  return {
    sourceType: 'store',
    sourceRef: params.orderRef,
    paymentMethod: params.paymentMethod,
    issuedAt: formatISODate(new Date()),
    client,
    items: lineItems,
  };
};

export const issueFactPtInvoice = async (input: FactPtIssueInput): Promise<FactPtDocumentRecord | null> => {
  if (!supabaseServer) return null;

  const config = getFactPtConfig(input.sourceType);
  if (!config) {
    throw new Error('fact.pt nao configurado.');
  }

  const existing = await supabaseServer
    .from('factpt_documents')
    .select('id, status, factpt_document_id, factpt_url')
    .eq('source_type', input.sourceType)
    .eq('source_ref', input.sourceRef)
    .maybeSingle();

  const existingRecord = existing as unknown as FactPtDocumentRecord;

  if (existingRecord?.status === 'issued') {
    if (existingRecord.factpt_document_id) {
      await sendFactPtEmails(config, input, existingRecord.factpt_document_id, existingRecord.factpt_url);
    }
    return existingRecord;
  }

  const identifierId = sanitizeIdentifierId(`${input.sourceType}-${input.sourceRef}`);
  const paymentType = resolvePaymentType(input.paymentMethod);

  const factptClientId = await resolveFactPtClient(input.client, config);
  const items = await Promise.all(
    input.items.map(async (item, index) => {
      const taxRate = resolveTaxRate(item.referenceBase, item.taxRate);
      const taxId = await resolveTaxIdByRate(config, taxRate);
      return {
        description: item.description.slice(0, 150),
        price: item.price,
        reference: buildItemReference(item.referenceBase, input.sourceRef, index),
        retention: item.retention ?? false,
        type: item.type,
        unitId: item.unitId ?? 1,
        taxId,
        quantity: item.quantity ?? 1,
      };
    }),
  );

  const payload: FactPtDocumentInput = {
    client: { id: factptClientId },
    document: {
      date: input.issuedAt,
      paymentType,
      markPaid: true,
      identifierId,
      language: 'pt',
    },
    items,
  };

  const { data: record } = await supabaseServer
    .from('factpt_documents')
    .upsert(
      {
        source_type: input.sourceType,
        source_ref: input.sourceRef,
        status: 'pending',
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_type,source_ref' },
    )
    .select('id, status, factpt_document_id, factpt_url')
    .maybeSingle();

  try {
    const response = await factptRequest<{ data?: { id: string }; link?: string; permanentUrl?: string }>(
      config,
      'POST',
      '/documents/invoicereceipt',
      payload,
    );

    const factptDocumentId = response?.data?.id ?? null;
    let factptUrl = response?.permanentUrl ?? response?.link ?? null;
    if (factptDocumentId) {
      try {
        const detail = await factptRequest<{ data?: { permanentUrl?: string; link?: string } }>(
          config,
          'GET',
          `/documents/${factptDocumentId}`,
        );
        factptUrl = detail?.data?.permanentUrl ?? detail?.data?.link ?? factptUrl;
      } catch (err) {
        console.warn('Nao foi possivel obter URL permanente do documento fact.pt:', err);
      }
    }

    const { data: updated } = await supabaseServer
      .from('factpt_documents')
      .update({
        status: 'issued',
        factpt_document_id: factptDocumentId,
        factpt_url: factptUrl,
        response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record?.id)
      .select('id, status, factpt_document_id, factpt_url')
      .maybeSingle();

    const finalRecord = (updated ?? record) as FactPtDocumentRecord;

    if (factptDocumentId) {
      await sendFactPtEmails(config, input, factptDocumentId, factptUrl);
    }

    return finalRecord;
  } catch (err: any) {
    const message = err?.message || 'Erro ao emitir documento.';
    if (message.toLowerCase().includes('identifier id already exists')) {
      const { data: updated } = await supabaseServer
        .from('factpt_documents')
        .update({
          status: 'issued',
          error: 'Documento já existe no fact.pt (identifierId duplicado).',
          updated_at: new Date().toISOString(),
        })
        .eq('id', record?.id)
        .select('id, status, factpt_document_id, factpt_url')
        .maybeSingle();
      return (updated ?? record) as FactPtDocumentRecord;
    }
    await supabaseServer
      .from('factpt_documents')
      .update({
        status: 'failed',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record?.id);
    throw err;
  }
};
