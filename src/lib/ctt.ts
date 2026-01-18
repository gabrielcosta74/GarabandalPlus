type CttShipmentPayload = {
  orderRef: string;
  recipientName: string;
  address1: string;
  address2?: string | null;
  city: string;
  postalCode: string;
  country: string;
};

const cttApiUrl = process.env.CTT_API_URL || '';
const cttApiKey = process.env.CTT_API_KEY || '';

export const createCttShipment = async (_payload: CttShipmentPayload) => {
  if (!cttApiUrl || !cttApiKey) {
    console.warn('CTT_API_URL ou CTT_API_KEY não configurado.');
    return { ok: false, reason: 'missing_config' } as const;
  }

  // Placeholder para integração CTT.
  return { ok: false, reason: 'not_implemented' } as const;
};
