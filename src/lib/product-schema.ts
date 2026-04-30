export const getPriceValidUntil = () => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

export const buildMerchantReturnPolicy = (isDigital: boolean) => ({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: ['BR', 'PT'],
  returnPolicyCategory: isDigital
    ? 'https://schema.org/MerchantReturnNotPermitted'
    : 'https://schema.org/MerchantReturnFiniteReturnWindow',
  ...(!isDigital
    ? {
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      }
    : {}),
});
