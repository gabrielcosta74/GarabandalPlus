const DEFAULT_MEMBERSHIP_AMOUNT_EUR = 25;
const DEV_TEST_MEMBERSHIP_AMOUNT_EUR = 0.1;

const toValidAmount = (raw?: string | null) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
};

export const getMembershipAmountServer = () => {
  const override =
    toValidAmount(process.env.MEMBERSHIP_AMOUNT_EUR) ??
    toValidAmount(process.env.NEXT_PUBLIC_MEMBERSHIP_AMOUNT_EUR);
  if (override) return override;
  if (process.env.NODE_ENV === 'development') return DEV_TEST_MEMBERSHIP_AMOUNT_EUR;
  return DEFAULT_MEMBERSHIP_AMOUNT_EUR;
};

export const getMembershipAmountClient = () => {
  const override = toValidAmount(process.env.NEXT_PUBLIC_MEMBERSHIP_AMOUNT_EUR);
  if (override) return override;
  if (process.env.NODE_ENV === 'development') return DEV_TEST_MEMBERSHIP_AMOUNT_EUR;
  return DEFAULT_MEMBERSHIP_AMOUNT_EUR;
};

