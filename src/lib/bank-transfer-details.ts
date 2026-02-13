export const BANK_TRANSFER_SITE_CONTENT_KEY = 'bank_transfer_details';

export type BankTransferDetails = {
  iban: string;
  beneficiary_name: string;
  bank_name: string;
  bic_swift: string;
  address_street: string;
  address_postal_code: string;
  address_city: string;
  address_country: string;
  reference_note: string;
  support_email: string;
};

export const DEFAULT_BANK_TRANSFER_DETAILS: BankTransferDetails = {
  iban: 'PT50 0033 0000 0000 0000 0000 0',
  beneficiary_name: 'Assoc. Mensagem de Garabandal',
  bank_name: 'Millennium BCP',
  bic_swift: '',
  address_street: '',
  address_postal_code: '',
  address_city: '',
  address_country: 'Portugal',
  reference_note: '',
  support_email: 'geral@apostoladodegarabandal.com',
};

export function normalizeBankTransferDetails(input: unknown): BankTransferDetails {
  const src = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const pick = (key: keyof BankTransferDetails) => {
    const value = src[key];
    return typeof value === 'string' ? value : DEFAULT_BANK_TRANSFER_DETAILS[key];
  };

  return {
    iban: pick('iban'),
    beneficiary_name: pick('beneficiary_name'),
    bank_name: pick('bank_name'),
    bic_swift: pick('bic_swift'),
    address_street: pick('address_street'),
    address_postal_code: pick('address_postal_code'),
    address_city: pick('address_city'),
    address_country: pick('address_country'),
    reference_note: pick('reference_note'),
    support_email: pick('support_email'),
  };
}
