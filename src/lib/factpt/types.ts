export type FactPtSourceType = 'quota' | 'store' | 'donation' | 'pilgrimage';

export type FactPtEnvironment = 'sandbox' | 'production';

export type FactPtSeriesCode = '2026Q' | '2026L' | '2026D';

export type FactPtCredentialSlot = 'Q' | 'L' | 'D';

export type FactPtItemType = 'product' | 'service' | 'other';

export type FactPtDocumentType = 'invoice_receipt' | 'simplified_invoice';

/**
 * These values are deliberately explicit. Do not infer a FACT.pt payment type
 * from free-form provider text.
 */
export type FactPtPaymentMethod =
  | 'reduniq_other'
  | 'reduniq_credit_card'
  | 'reduniq_debit_card'
  | 'reduniq_multibanco'
  | 'reduniq_mbway'
  | 'reduniq_pix'
  | 'bank_transfer';

export type FactPtPaymentTypeCode = 1 | 2 | 8 | 9 | 11;

export type FactPtRemoteClient = {
  id: string;
  name?: string;
  tin?: string;
  email?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
  isFinalConsumer?: boolean;
};

export type FactPtTax = {
  id: string | number;
  value: string;
  name?: string;
};

export type FactPtProduct = {
  id: string | number;
  reference: string;
  description: string;
  price: string;
  unitName?: string;
  taxValue?: string;
  taxId?: string;
  type: FactPtItemType;
  hasRetention?: boolean;
  isActive?: boolean;
};

export type FactPtPage<T> = {
  data: T[];
  totalItems?: number;
  totalPages?: number;
  previous?: string;
  next?: string;
};

export type FactPtCreatedResource = {
  data: { id: string | number };
  message?: string;
  link?: string;
  permanentUrl?: string;
};

export type FactPtResponseEnvelope<T> = {
  HttpStatusCode?: number;
  AppStatusCode?: number;
  AppStatusMsg?: string;
  AppResponse?: T;
};

export type FactPtErrorResponse = {
  errors?: Record<string, string | string[]>;
  message?: string;
};

export type FactPtClientCreateInput = {
  name: string;
  tin?: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone?: string;
  brand?: string;
  site?: string;
  finalConsumer: boolean;
};

export type FactPtDocumentItem = {
  id?: string | number;
  description: string;
  price: number;
  reference: string;
  retention: boolean;
  type: FactPtItemType;
  unitId: string | number;
  taxId: string | number;
  quantity: number;
  discount?: number;
};

export type FactPtInvoiceReceiptPayload = {
  client: { id: string | number };
  document: {
    date: string;
    duePayment: string;
    paymentType: FactPtPaymentTypeCode;
    markPaid: true;
    comments?: string;
    reference?: string;
    download: false;
    allowRound: true;
    identifierId: string;
    language: string;
  };
  items: FactPtDocumentItem[];
};

export type FactPtSimplifiedInvoicePayload = {
  document: {
    date: string;
    paymentTerm: 0;
    paymentType: FactPtPaymentTypeCode;
    comments?: string;
    reference?: string;
    download: false;
    allowRound: true;
    identifierId: string;
    language: string;
  };
  items: FactPtDocumentItem[];
};

export type FactPtBillingCustomer = {
  name: string;
  email: string;
  nif?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
};

export type FactPtFiscalLine = {
  /**
   * Existing FACT.pt product selected by stable reference. When present, the
   * document updates its fiscal values for this transaction instead of
   * creating a duplicate catalogue item.
   */
  productId?: string | number;
  reference: string;
  description: string;
  type: FactPtItemType;
  quantity: number;
  /**
   * Unit price excluding tax. This is the price sent to FACT.pt.
   */
  unitPriceNet: number;
  taxRate: number;
  taxId: string | number;
  unitId: string | number;
  /**
   * FACT.pt percentage discount, from 0 to 100.
   */
  discount?: number;
  retention?: boolean;
};

export type FactPtFiscalSnapshot = {
  sourceType: FactPtSourceType;
  sourceId: string;
  paidAt: string;
  total: number;
  currency: 'EUR';
  paymentMethod: FactPtPaymentMethod;
  customer: FactPtBillingCustomer;
  lines: FactPtFiscalLine[];
  language?: string;
  reference?: string;
  emailSourceLabel?: string;
  /**
   * Existing FACT.pt customer found while preparing the fiscal snapshot.
   * It is persisted with the reviewed snapshot so emission reuses that exact
   * customer instead of creating a duplicate.
   */
  existingClientId?: string;
};

export type FactPtDocumentDecision =
  | {
      type: 'invoice_receipt';
      reason: 'complete_billing_data' | 'pilgrimage_final_consumer';
    }
  | {
      type: 'simplified_invoice';
      reason: 'missing_billing_data_within_limit';
    }
  | {
      type: 'needs_data';
      reason:
        | 'missing_email'
        | 'missing_pilgrimage_holder_data'
        | 'missing_billing_data_above_simplified_limit'
        | 'invalid_snapshot';
      missingFields?: string[];
    };

export type FactPtBuiltDocument =
  | {
      type: 'invoice_receipt';
      series: FactPtSeriesCode;
      credentialSlot: FactPtCredentialSlot;
      identifierId: string;
      payload: FactPtInvoiceReceiptPayload;
    }
  | {
      type: 'simplified_invoice';
      series: FactPtSeriesCode;
      credentialSlot: FactPtCredentialSlot;
      identifierId: string;
      payload: FactPtSimplifiedInvoicePayload;
    };
