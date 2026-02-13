export type PaymentProvider = 'stripe' | 'reduniq' | 'manual';

export type PaymentOption = {
  id: string;
  label: string;
  description: string;
  provider: PaymentProvider;
  iconSrc?: string;
  iconAlt?: string;
  highlight?: boolean;
  badge?: string;
};

export const UNIFIED_ONLINE_PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'reduniq_card',
    label: 'Cartão de Crédito',
    description: 'Visa / Mastercard',
    provider: 'reduniq',
    iconSrc: '/payment-icons/credit-card.svg',
    iconAlt: 'Cartão de Crédito',
  },
  {
    id: 'reduniq_mbway',
    label: 'MB WAY',
    description: 'Pagamento instantâneo',
    provider: 'reduniq',
    iconSrc: '/payment-icons/mbway.svg',
    iconAlt: 'MB WAY',
  },
  {
    id: 'reduniq_pix',
    label: 'PIX',
    description: 'Pagamento instantâneo',
    provider: 'reduniq',
    iconSrc: '/payment-icons/pix-original.png',
    iconAlt: 'PIX',
    highlight: true,
  },
  {
    id: 'reduniq_multibanco',
    label: 'Multibanco',
    description: 'Pagamento de serviços',
    provider: 'reduniq',
    iconSrc: '/payment-icons/multibanco.svg',
    iconAlt: 'Multibanco',
  },
];

export const UNIFIED_DONATION_PAYMENT_OPTIONS: PaymentOption[] = [
  ...UNIFIED_ONLINE_PAYMENT_OPTIONS,
  {
    id: 'bank_transfer',
    label: 'Transferência Bancária',
    description: 'Transferência manual',
    provider: 'manual',
    iconAlt: 'IBAN',
  },
];
