"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CartItem, Product, loadCart, saveCart } from '../data';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { applyMemberDiscount, isActiveMember, MEMBER_DISCOUNT_RATE } from '../../../lib/store-discounts';
import { useCurrency } from '../../../components/providers/CurrencyProvider';
import { UNIFIED_ONLINE_PAYMENT_OPTIONS } from '../../../lib/payment-options';
import {
  formatPostalCode,
  getPostalInputMode,
  getPostalInvalidMessage,
  listCountryOptions,
  normalizePhone,
  resolveCountryMeta,
  validatePostalCode,
  withCountryPrefix,
} from '../../../lib/country-utils';
import { getShippingCost, getShippingLabel, getShippingOrigin, isPhysicalShippingAllowed } from '../../../lib/shipping-rules';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, CreditCard, User, ShoppingBag, MapPin, ArrowLeft, ShieldCheck, Loader2, QrCode, Wallet } from 'lucide-react';
import { useLocale } from '../../../contexts/LocaleContext';
import { getStoreHomePath } from '../../../lib/store-i18n';
import { captureStoreEvent, getAnalyticsRequestContext } from '../../../lib/analytics';
import { applyStoreBookPromo } from '../../../lib/store-promo';

const getVatRate = (product: Product) => (product.isPhysical ? 0.06 : 0.23);

const getVatBreakdown = (value: number, rate: number) => {
  const base = value / (1 + rate);
  const vat = value - base;
  return { base, vat };
};

const formatVatDisplay = (vatValue: number, formatter: (value: number) => string) => {
  if (vatValue > 0 && vatValue < 0.01) return '< 0,01 €';
  return formatter(vatValue);
};

type AddressSuggestion = {
  label: string;
  address1: string;
  city: string;
  postalCode: string;
  country: string;
};

type SavedProfile = {
  numero_socio?: number | null;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  country?: string | null;
  nif?: string | null;
  is_membro?: boolean | null;
  estado_quota?: string | null;
  tipo_subscricao?: string | null;
  proxima_quota?: string | null;
  store_credits?: number | null;
};

const getCartItemKey = (item: Pick<CartItem, 'id' | 'variantId' | 'variantName'>) =>
  `${item.id}::${item.variantId || item.variantName || 'default'}`;

const normalizeCartItems = (items: CartItem[]) => {
  const merged = new Map<string, CartItem>();

  items.forEach((item) => {
    if (!item?.id || item.qty <= 0) return;
    const key = getCartItemKey(item);
    const existing = merged.get(key);

    merged.set(key, existing
      ? { ...existing, qty: existing.qty + item.qty }
      : { ...item });
  });

  return Array.from(merged.values());
};

const ADDRESS_AUTOCOMPLETE_ENABLED = process.env.NEXT_PUBLIC_ADDRESS_AUTOCOMPLETE === '1';
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api';

const loadCheckoutDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('store:checkout');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCheckoutDraft = (data: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('store:checkout', JSON.stringify(data));
};

export default function CheckoutPage() {
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const { formatPrice } = useCurrency();
  const countryOptions = useMemo(() => listCountryOptions(isEn ? 'en' : 'pt-PT'), [isEn]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form State
  const [buyer, setBuyer] = useState({
    fullName: '',
    email: '',
    nif: '',
    phone: '',
  });
  const [shipping, setShipping] = useState({
    address1: '',
    address2: '',
    doorNumber: '',
    city: '',
    postalCode: '',
    country: 'PT',
  });
  const [billing, setBilling] = useState({
    address1: '',
    city: '',
    postalCode: '',
    country: 'PT',
  });
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null);
  const [useSavedAddress, setUseSavedAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveCheckout, setSaveCheckout] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [isMemberActive, setIsMemberActive] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(UNIFIED_ONLINE_PAYMENT_OPTIONS[0].id);
  const [ownedDigitalProductIds, setOwnedDigitalProductIds] = useState<Set<string>>(new Set());
  const [checkoutStartedTracked, setCheckoutStartedTracked] = useState(false);

  // Store Credits Gamification
  const [applyCredits, setApplyCredits] = useState(false);
  const storeCreditsBalance = savedProfile?.store_credits || 0;
  // Set default billing logic based on cart type
  useEffect(() => {
    // If no physical items, billing cannot be same as shipping because shipping is hidden/optional
    const hasPhysical = cart.map(i => products.find(p => p.id === i.id)).some(p => p?.isPhysical);
    if (!hasPhysical) setBillingSameAsShipping(false);
  }, [cart, products]);

  const countryMeta = useMemo(() => resolveCountryMeta(shipping.country), [shipping.country]);
  const billingCountryMeta = useMemo(() => resolveCountryMeta(billing.country), [billing.country]);
  const selectedPayment = useMemo(
    () => UNIFIED_ONLINE_PAYMENT_OPTIONS.find((option) => option.id === selectedPaymentId) ?? UNIFIED_ONLINE_PAYMENT_OPTIONS[0],
    [selectedPaymentId],
  );
  const localizedPaymentOptions = useMemo(() => UNIFIED_ONLINE_PAYMENT_OPTIONS.map((option) => ({
    ...option,
    label: isEn
      ? ({
        'Cartão de Crédito': 'Credit Card',
      } as Record<string, string>)[option.label] || option.label
      : option.label,
    description: isEn
      ? ({
        'Pagamento instantâneo': 'Instant payment',
        'Pagamento de serviços': 'Service payment',
      } as Record<string, string>)[option.description] || option.description
      : option.description,
    iconAlt: option.iconAlt && isEn
      ? ({ 'Cartão de Crédito': 'Credit Card' } as Record<string, string>)[option.iconAlt] || option.iconAlt
      : option.iconAlt,
  })), [isEn]);
  const nifLabel = shipping.country === 'BR'
    ? (isEn ? 'CPF (optional)' : 'CPF (opcional)')
    : (isEn ? 'TIN / CPF (optional)' : 'NIF / CPF (opcional)');
  const nifHelper =
    shipping.country === 'BR'
      ? (isEn ? 'CPF: taxpayer number in Brazil (11 digits).' : 'CPF: número de contribuinte no Brasil (11 dígitos).')
      : (isEn ? 'TIN / CPF: taxpayer number.' : 'NIF / CPF: número de contribuinte.');

  const isValidNif = (value: string, country: string) => {
    const digits = value.replace(/\\D/g, '');
    if (!digits) return true;
    if (country === 'PT') return digits.length === 9;
    if (country === 'BR') return digits.length === 11;
    return digits.length >= 6;
  };

  const cartEntries = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((prod) => prod.id === item.id);
        if (!product) return null;
        const basePrice = Number(product.price || 0);
        const promoPrice = applyStoreBookPromo(basePrice, product);
        const memberPrice = applyMemberDiscount(basePrice, isMemberActive);
        const effectivePrice = promoPrice.active ? promoPrice.discountedPrice : memberPrice;
        return {
          ...product,
          cartKey: getCartItemKey(item),
          variantId: item.variantId,
          qty: item.qty,
          variantName: item.variantName,
          basePrice,
          price: effectivePrice,
          baseTotal: basePrice * item.qty,
          total: effectivePrice * item.qty,
          promoActive: promoPrice.active,
          promoDiscount: promoPrice.active ? promoPrice.discountAmount * item.qty : 0,
          memberDiscount: !promoPrice.active && isMemberActive ? (basePrice - memberPrice) * item.qty : 0,
        };
      })
      .filter(Boolean) as Array<Product & { cartKey: string; variantId?: string; qty: number; total: number; baseTotal: number; basePrice: number; price: number; variantName?: string; promoActive: boolean; promoDiscount: number; memberDiscount: number }>;
  }, [cart, products, isMemberActive]);

  const hasPhysical = cartEntries.some((item) => item.isPhysical);
  const baseSubtotal = useMemo(() => cartEntries.reduce((sum, item) => sum + item.baseTotal, 0), [cartEntries]);
  const discountedTotal = useMemo(() => cartEntries.reduce((sum, item) => sum + item.total, 0), [cartEntries]);
  const promoDiscountValue = useMemo(() => cartEntries.reduce((sum, item) => sum + item.promoDiscount, 0), [cartEntries]);
  const memberDiscountValue = useMemo(() => cartEntries.reduce((sum, item) => sum + item.memberDiscount, 0), [cartEntries]);
  const potentialMemberSavings = useMemo(
    () => cartEntries.reduce((sum, item) => sum + (item.promoActive ? 0 : item.baseTotal * MEMBER_DISCOUNT_RATE), 0),
    [cartEntries],
  );
  const vatTotals = useMemo(() => {
    return cartEntries.reduce(
      (acc, item) => {
        const rate = getVatRate(item);
        const breakdown = getVatBreakdown(item.total, rate);
        acc.base += breakdown.base;
        acc.vat += breakdown.vat;
        return acc;
      },
      { base: 0, vat: 0 },
    );
  }, [cartEntries]);

  const shippingCost = useMemo(
    () => getShippingCost(shipping.country, hasPhysical),
    [shipping.country, hasPhysical],
  );
  const shippingOrigin = useMemo(
    () => (hasPhysical ? getShippingOrigin(shipping.country) : null),
    [shipping.country, hasPhysical],
  );
  const shippingOriginLabel = shippingOrigin === 'BR' ? 'Brasil' : shippingOrigin === 'PT' ? 'Portugal' : null;
  const rawTotalWithShipping = useMemo(
    () => discountedTotal + (typeof shippingCost === 'number' ? shippingCost : 0),
    [discountedTotal, shippingCost],
  );

  const appliedCreditsValue = useMemo(() => {
    if (!applyCredits || storeCreditsBalance <= 0) return 0;
    return Math.min(storeCreditsBalance, rawTotalWithShipping);
  }, [applyCredits, storeCreditsBalance, rawTotalWithShipping]);

  const totalToPay = useMemo(() => Math.max(0, rawTotalWithShipping - appliedCreditsValue), [rawTotalWithShipping, appliedCreditsValue]);
  const checkoutAnalyticsBase = useMemo(() => ({
    step,
    item_count: cartEntries.reduce((sum, item) => sum + item.qty, 0),
    unique_items: cartEntries.length,
    cart_total: Number(rawTotalWithShipping.toFixed(2)),
    total_to_pay: Number(totalToPay.toFixed(2)),
    has_physical: hasPhysical,
    has_member_discount: isMemberActive && memberDiscountValue > 0,
    has_book_promo: promoDiscountValue > 0,
    uses_store_credits: applyCredits && appliedCreditsValue > 0,
    locale,
  }), [appliedCreditsValue, applyCredits, cartEntries, hasPhysical, isMemberActive, locale, memberDiscountValue, promoDiscountValue, rawTotalWithShipping, step, totalToPay]);

  // Load Data Effects
  useEffect(() => {
    const normalizedCart = normalizeCartItems(loadCart());
    setCart(normalizedCart);
    saveCart(normalizedCart);
    const draft = loadCheckoutDraft();
    if (draft?.saveCheckout) {
      setSaveCheckout(true);
      if (draft?.buyer) setBuyer((prev) => ({ ...prev, ...draft.buyer }));
      if (draft?.shipping) setShipping(draft.shipping);
    }
  }, []);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data.session;
      setSessionToken(session?.access_token ?? null);
      setSessionUserId(session?.user?.id ?? null);
      if (session?.user?.email) {
        setBuyer((prev) => (prev.email ? prev : { ...prev, email: session.user?.email || '' }));
      }
      if (session?.user?.id) {
        const { data: profile } = await supabaseBrowser
          .from('membros')
          .select('nome, email, telefone, address, postal_code, country, nif, is_membro, estado_quota, tipo_subscricao, proxima_quota, store_credits')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile) {
          setSavedProfile(profile as SavedProfile);
          setIsMemberActive(isActiveMember(profile));
          setBuyer((prev) => ({
            fullName: prev.fullName || profile.nome || '',
            email: prev.email || profile.email || session.user?.email || '',
            phone: prev.phone || profile.telefone || '',
            nif: prev.nif || profile.nif || '',
          }));
          const hasSavedAddress = !!(profile.address || profile.postal_code || profile.country);
          if (hasSavedAddress) {
            setShipping((prev) => {
              const hasLocal = !!(prev.address1 || prev.postalCode || prev.city || prev.doorNumber);
              if (hasLocal) return prev;
              return {
                ...prev,
                address1: profile.address || '',
                postalCode: profile.postal_code || '',
                country: profile.country || prev.country,
              };
            });
            setUseSavedAddress(true);
          }
        }
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetch(`/api/store/products?includeVariants=0&locale=${locale}`);
        if (!res.ok) return;
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.warn('Produtos indisponíveis.', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, [locale]);

  useEffect(() => {
    if (!cartEntries.length || checkoutStartedTracked) return;
    captureStoreEvent('store_checkout_started', checkoutAnalyticsBase);
    setCheckoutStartedTracked(true);
  }, [cartEntries.length, checkoutAnalyticsBase, checkoutStartedTracked]);

  useEffect(() => {
    if (!cartEntries.length) return;
    captureStoreEvent('store_checkout_step_viewed', checkoutAnalyticsBase);
  }, [cartEntries.length, checkoutAnalyticsBase]);

  useEffect(() => {
    const loadOwnedDigitalProducts = async () => {
      if (!sessionToken) {
        setOwnedDigitalProductIds(new Set());
        return;
      }
      try {
        const res = await fetch('/api/store/library', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>(
          Array.isArray(data?.items)
            ? data.items
              .map((item: any) => String(item?.productId || '').trim())
              .filter((id: string) => id.length > 0)
            : [],
        );
        setOwnedDigitalProductIds(ids);
      } catch {
        // Non-blocking check; checkout must remain usable.
      }
    };
    loadOwnedDigitalProducts();
  }, [sessionToken]);

  useEffect(() => {
    if (saveCheckout) {
      saveCheckoutDraft({ buyer, shipping, saveCheckout: true });
    } else {
      saveCheckoutDraft({ saveCheckout: false });
    }
  }, [buyer, shipping, saveCheckout]);

  // Autocomplete Logic
  useEffect(() => {
    if (!ADDRESS_AUTOCOMPLETE_ENABLED) return;
    const query = shipping.address1.trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const fetchSuggestions = async () => {
        setAddressLoading(true);
        try {
          const countryLabel = shipping.country
            ? countryOptions.find((option) => option.code === shipping.country)?.label
            : '';
          const queryText = countryLabel ? `${query}, ${countryLabel}` : query;
          const params = new URLSearchParams({ q: queryText, limit: '5', lang: isEn ? 'en' : 'pt' });
          const url = `${PHOTON_ENDPOINT}?${params.toString()}`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) { setAddressSuggestions([]); return; }
          const data = (await res.json()) as { features?: Array<any> };
          const suggestions =
            data.features?.map((feature) => ({
              label: feature.properties?.name
                ? `${feature.properties.name}${feature.properties?.city ? `, ${feature.properties.city}` : ''}`
                : feature.properties?.label || queryText,
              address1: feature.properties?.street
                ? `${feature.properties.street}${feature.properties?.housenumber ? ` ${feature.properties.housenumber}` : ''}`
                : feature.properties?.name || queryText,
              city: feature.properties?.city || feature.properties?.town || feature.properties?.village || '',
              postalCode: feature.properties?.postcode || '',
              country: feature.properties?.countrycode ? feature.properties.countrycode.toUpperCase() : shipping.country,
            })) || [];
          setAddressSuggestions(suggestions);
        } catch (err) {
          if ((err as Error).name !== 'AbortError') setAddressSuggestions([]);
        } finally {
          setAddressLoading(false);
        }
      };
      fetchSuggestions();
    }, 350);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [shipping.address1, shipping.country, countryOptions, isEn]);

  const applySavedAddress = (profile: SavedProfile) => {
    setShipping((prev) => ({
      ...prev,
      address1: profile.address || prev.address1,
      postalCode: profile.postal_code || prev.postalCode,
      country: profile.country || prev.country,
    }));
  };

  const updateQty = (cartKey: string, qty: number) => {
    setCart((prev) => {
      const next = normalizeCartItems(
        qty <= 0
          ? prev.filter((item) => getCartItemKey(item) !== cartKey)
          : prev.map((item) => (getCartItemKey(item) === cartKey ? { ...item, qty } : item)),
      );
      saveCart(next);
      return next;
    });
  };

  const nextStep = () => {
    setError(null);
    if (step === 1) {
      if (!cartEntries.length) {
        setError(isEn ? 'Add items to your cart.' : 'Adiciona artigos ao carrinho.');
        captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'empty_cart' });
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!buyer.fullName || !buyer.email) {
        setError(isEn ? "Enter the buyer's name and email." : 'Indica o nome e o email do comprador.');
        captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'buyer_missing' });
        return;
      }
      if (!isValidNif(buyer.nif, shipping.country)) {
        setError(shipping.country === 'BR' ? (isEn ? 'Invalid CPF.' : 'CPF inválido.') : (isEn ? 'Invalid tax number.' : 'NIF inválido.'));
        captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'tax_number_invalid', country: shipping.country || null });
        return;
      }

      if (hasPhysical) {
        if (!shipping.address1 || !shipping.doorNumber || !shipping.city || !shipping.postalCode) {
          setError(isEn ? 'Enter the full shipping address.' : 'Indica a morada de envio completa.');
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'shipping_missing', country: shipping.country || null });
          return;
        }
        if (!shipping.country) {
          setError(isEn ? 'Select the shipping country.' : 'Seleciona o país de envio.');
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'shipping_country_missing' });
          return;
        }
        if (!isPhysicalShippingAllowed(shipping.country)) {
          setError(isEn ? 'Physical shipping is not available for this country.' : 'Envio físico não disponível para este país.');
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'shipping_country_blocked', country: shipping.country });
          return;
        }
        if (!validatePostalCode(shipping.country, shipping.postalCode)) {
          setError(getPostalInvalidMessage(shipping.country, isEn ? 'en' : 'pt-PT'));
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'shipping_postal_invalid', country: shipping.country });
          return;
        }
      }

      if (!billingSameAsShipping) {
        if (!billing.address1 || !billing.city || !billing.postalCode) {
          setError(isEn ? 'Enter the full billing address.' : 'Indica a morada de faturação completa.');
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'billing_missing', country: billing.country || null });
          return;
        }
        if (!billing.country) {
          setError(isEn ? 'Select the billing country.' : 'Seleciona o país de faturação.');
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'billing_country_missing' });
          return;
        }
        if (!validatePostalCode(billing.country, billing.postalCode)) {
          setError(isEn ? `Invalid billing postal code (${billing.country}).` : `Código postal de faturação inválido (${billing.country}).`);
          captureStoreEvent('store_checkout_validation_failed', { ...checkoutAnalyticsBase, reason: 'billing_postal_invalid', country: billing.country });
          return;
        }
      }

      setStep(3);
    }
  };

  const previousStep = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleCheckout = async () => {
    if (!cartEntries.length) return;
    setLoading(true);
    setError(null);
    captureStoreEvent('store_checkout_payment_submitted', {
      ...checkoutAnalyticsBase,
      payment_provider: totalToPay === 0 ? 'wallet' : selectedPayment.provider,
      shipping_country: hasPhysical ? shipping.country : null,
      billing_country: billingSameAsShipping ? shipping.country : billing.country,
    });
    try {
      if (saveAddress && supabaseBrowser && sessionUserId) {
        await supabaseBrowser.from('membros').update({
          nome: buyer.fullName || null,
          email: buyer.email || null,
          telefone: buyer.phone || null,
          nif: buyer.nif || null,
          address: shipping.address1 || null,
          postal_code: shipping.postalCode || null,
          country: shipping.country || null,
        }).eq('id', sessionUserId);
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let tokenToUse = sessionToken;
      if (supabaseBrowser) {
        const { data } = await supabaseBrowser.auth.getSession();
        tokenToUse = data.session?.access_token ?? tokenToUse;
      }
      if (tokenToUse) headers.Authorization = `Bearer ${tokenToUse}`;
      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartEntries.map((item) => ({ id: item.id, name: item.name, price: item.price, qty: item.qty })),
          locale,
          total: Number(rawTotalWithShipping.toFixed(2)),
          finalTotalToPay: Number(totalToPay.toFixed(2)),
          applyStoreCredits: applyCredits && storeCreditsBalance > 0,
          appliedCreditsValue: Number(appliedCreditsValue.toFixed(2)),
          provider: totalToPay === 0 ? 'wallet' : selectedPayment.provider, // Instant bypass if 0
          buyer,
          shipping: hasPhysical ? shipping : null,
          billing: billingSameAsShipping ? { ...shipping, address1: `${shipping.address1} ${shipping.doorNumber}`.trim() } : billing,
          analytics: getAnalyticsRequestContext(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || (isEn ? 'Could not start the payment.' : 'Não foi possível iniciar o pagamento.'));
      }
      const { url, orderRef } = await res.json();
      if (!url) throw new Error(isEn ? 'Server error.' : 'Erro no servidor.');
      captureStoreEvent('store_payment_started', {
        ...checkoutAnalyticsBase,
        payment_provider: totalToPay === 0 ? 'wallet' : selectedPayment.provider,
      });
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || (isEn ? 'Error starting payment.' : 'Erro ao iniciar pagamento.'));
      captureStoreEvent('store_checkout_payment_failed', {
        ...checkoutAnalyticsBase,
        payment_provider: totalToPay === 0 ? 'wallet' : selectedPayment.provider,
        reason: err?.message ? String(err.message).slice(0, 120) : 'unknown',
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting classes
  const inputClass = "w-full rounded-xl border-gray-200 bg-gray-50/50 py-3 px-4 text-gray-900 focus:bg-white focus:border-garabandal-gold focus:ring-garabandal-gold/20 transition-all outline-none md:text-sm";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 ml-1";

  if (loadingProducts && step === 1 && cart.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garabandal-mist">
        <Loader2 className="w-8 h-8 text-garabandal-gold animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-garabandal-mist selection:bg-garabandal-gold/20 flex flex-col">
      {/* Checkout Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={getStoreHomePath(locale)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-garabandal-dark transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {isEn ? 'Back to Store' : 'Voltar à Loja'}
          </Link>
          <h1 className="font-serif text-lg font-bold text-garabandal-dark hidden sm:block">{isEn ? 'Secure Checkout' : 'Checkout Seguro'}</h1>
          <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isEn ? 'Secure Environment' : 'Ambiente Seguro'}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-36 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* Left Column: Form & Steps */}
          <div className="lg:col-span-7 space-y-8">

            {/* Steps Indicator */}
            <nav aria-label="Progress">
              <ol role="list" className="flex items-center">
                {[
                  { id: 1, name: isEn ? 'Cart' : 'Carrinho', icon: ShoppingBag },
                  { id: 2, name: isEn ? 'Details & Shipping' : 'Dados & Envio', icon: MapPin },
                  { id: 3, name: isEn ? 'Payment' : 'Pagamento', icon: CreditCard },
                ].map((s, idx) => {
                  const isActive = step === s.id;
                  const isComplete = step > s.id;
                  return (
                    <li key={s.name} className={`${idx !== 0 ? 'ml-4 sm:ml-8 flex-1' : ''} relative flex items-center`}>
                      {idx !== 0 && (
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className={`h-0.5 w-full transition-colors duration-300 ${isComplete ? 'bg-garabandal-gold' : 'bg-gray-200'}`} style={{ left: '-50%', width: '100%' }} />
                        </div>
                      )}
                      <div className={`relative flex items-center justify-center gap-2 group ${idx !== 0 ? 'pl-4' : ''}`}>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${isActive || isComplete ? 'bg-garabandal-gold text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                          {isComplete ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                        </span>
                        <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-garabandal-dark' : 'text-gray-500'}`}>{s.name}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8"
              >
                {step === 1 && (
                  <div className="space-y-6">
                    <h2 className="font-serif text-2xl font-bold text-garabandal-dark">{isEn ? 'Your cart' : 'O teu carrinho'}</h2>
                    {cartEntries.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">{isEn ? 'Your cart is empty.' : 'O carrinho está vazio.'}</p>
                        <Link href={getStoreHomePath(locale)} className="mt-4 inline-block text-garabandal-gold font-bold hover:underline">
                          {isEn ? 'Go to store' : 'Ir para a loja'}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {cartEntries.map((item) => (
                          <div className="grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md sm:grid-cols-[80px_1fr] sm:gap-4 sm:p-4" key={item.cartKey}>
                            <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 bg-white rounded-xl overflow-hidden shrink-0 border border-gray-100">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex flex-col justify-between gap-3">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 sm:text-base">{item.name}</h3>
                                  {item.variantName && <p className="mt-1 w-fit rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{item.variantName}</p>}
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {item.promoActive && <span className="text-xs font-bold text-gray-400 line-through">{formatPrice(item.basePrice)}</span>}
                                    <span className={`text-sm font-semibold ${item.promoActive ? 'text-emerald-700' : 'text-gray-600'}`}>{formatPrice(item.price)}</span>
                                    {item.promoActive && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">-15%</span>}
                                  </div>
                                  {!item.isPhysical && ownedDigitalProductIds.has(item.id) && (
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-2 inline-block font-semibold">
                                      {isEn ? 'You already have this product in your library. You can buy it again if you want.' : 'Já tens este produto na tua biblioteca. Podes comprar novamente se quiseres.'}
                                    </p>
                                  )}
                                </div>
                                <button onClick={() => updateQty(item.cartKey, 0)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                                  <span className="sr-only">{isEn ? 'Remove' : 'Remover'}</span>
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                                  <button onClick={() => updateQty(item.cartKey, item.qty - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-gray-600 transition-colors hover:bg-white">-</button>
                                  <span className="w-7 text-center text-sm font-black text-gray-900">{item.qty}</span>
                                  <button onClick={() => updateQty(item.cartKey, item.qty + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-gray-600 transition-colors hover:bg-white">+</button>
                                </div>
                                <div className="ml-auto text-right">
                                  <p className="text-sm font-black text-gray-900">{formatPrice(item.total)}</p>
                                  <p className="hidden text-xs text-gray-400 sm:block">
                                    {formatVatDisplay(getVatBreakdown(item.price, getVatRate(item)).vat, formatPrice)} {isEn ? 'VAT included' : 'IVA incluído'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h2 className="font-serif text-2xl font-bold text-garabandal-dark flex items-center gap-2">
                        <User className="w-6 h-6 text-garabandal-gold" />
                        {isEn ? 'Buyer Details' : 'Dados do Comprador'}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className={labelClass}>{isEn ? 'Full Name *' : 'Nome Completo *'}</label>
                          <input type="text" value={buyer.fullName} onChange={(e) => setBuyer({ ...buyer, fullName: e.target.value })} className={inputClass} placeholder={isEn ? 'Your name' : 'Seu nome'} />
                        </div>
                        <div>
                          <label className={labelClass}>Email *</label>
                          <input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className={inputClass} placeholder={isEn ? 'name@example.com' : 'nome@exemplo.com'} />
                        </div>
                        <div>
                          <label className={labelClass}>{isEn ? 'Phone' : 'Telefone'}</label>
                          <input
                            type="tel"
                            value={buyer.phone}
                            onChange={(e) => setBuyer({ ...buyer, phone: withCountryPrefix(e.target.value, shipping.country) })}
                            onBlur={() => setBuyer({ ...buyer, phone: normalizePhone(withCountryPrefix(buyer.phone, shipping.country)) })}
                            className={inputClass}
                            placeholder={countryMeta?.phoneExample}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{nifLabel}</label>
                          <input type="text" value={buyer.nif} onChange={(e) => setBuyer({ ...buyer, nif: e.target.value })} className={inputClass} placeholder="123456789" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-100 h-px w-full" />


                    {hasPhysical && (
                      <div className="space-y-4 pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <h2 className="font-serif text-2xl font-bold text-garabandal-dark flex items-center gap-2">
                            <MapPin className="w-6 h-6 text-garabandal-gold" />
                            {isEn ? 'Shipping Address' : 'Morada de Envio'}
                          </h2>
                        </div>

                        {/* Saved Address Toggle */}
                        {savedProfile && (savedProfile.address || savedProfile.postal_code || savedProfile.country) && (
                          <div className="bg-garabandal-gold/5 border border-garabandal-gold/20 rounded-xl p-4 flex items-start gap-3">
                            <input type="checkbox" checked={useSavedAddress} onChange={(e) => { setUseSavedAddress(e.target.checked); if (e.target.checked && savedProfile) applySavedAddress(savedProfile); }} className="mt-1 w-4 h-4 text-garabandal-gold rounded border-gray-300 focus:ring-garabandal-gold" />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{isEn ? 'Use profile address' : 'Usar morada do perfil'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{savedProfile.address}, {savedProfile.postal_code} {savedProfile.country}</p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className={labelClass}>{isEn ? 'Country *' : 'País *'}</label>
                            <select value={shipping.country} onChange={(e) => setShipping({ ...shipping, country: e.target.value })} className={inputClass}>
                              {countryOptions.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2 relative">
                            <label className={labelClass}>{isEn ? 'Address *' : 'Morada *'}</label>
                            <input type="text" value={shipping.address1} onChange={(e) => setShipping({ ...shipping, address1: e.target.value })} className={inputClass} placeholder={isEn ? 'Street, Avenue, etc.' : 'Rua, Avenida, etc'} />
                            {ADDRESS_AUTOCOMPLETE_ENABLED && addressLoading && <div className="absolute right-3 top-9"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>}
                            {ADDRESS_AUTOCOMPLETE_ENABLED && addressSuggestions.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                {addressSuggestions.map((s, i) => (
                                  <button key={i} type="button" onClick={() => { setShipping({ ...shipping, address1: s.address1, city: s.city || shipping.city, postalCode: s.postalCode || shipping.postalCode, country: s.country || shipping.country }); setAddressSuggestions([]); }} className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                    <span className="font-bold text-gray-900">{s.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'Door / Floor *' : 'Nº Porta / Andar *'}</label>
                            <input type="text" value={shipping.doorNumber} onChange={(e) => setShipping({ ...shipping, doorNumber: e.target.value })} className={inputClass} placeholder={isEn ? 'E.g. 4th left' : 'Ex: 4º Esq'} />
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'Address line 2 (optional)' : 'Morada linha 2 (opcional)'}</label>
                            <input type="text" value={shipping.address2} onChange={(e) => setShipping({ ...shipping, address2: e.target.value })} className={inputClass} placeholder="" />
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'City *' : 'Cidade *'}</label>
                            <input type="text" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} className={inputClass} placeholder={isEn ? 'City' : 'Cidade'} />
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'Postal Code / ZIP *' : 'Código Postal / CEP *'}</label>
                            <input
                              type="text"
                              value={shipping.postalCode}
                              onChange={(e) => setShipping({ ...shipping, postalCode: formatPostalCode(e.target.value, shipping.country) })}
                              inputMode={getPostalInputMode(shipping.country)}
                              className={inputClass}
                              placeholder={countryMeta?.postalPlaceholder}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Billing Address Logic */}
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <h2 className="font-serif text-2xl font-bold text-garabandal-dark flex items-center gap-2">
                          <ShieldCheck className="w-6 h-6 text-garabandal-gold" />
                          {isEn ? 'Billing Details' : 'Dados de Faturação'}
                        </h2>
                      </div>

                      {hasPhysical && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={billingSameAsShipping}
                              onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                              className="w-5 h-5 rounded border-gray-300 text-garabandal-gold focus:ring-garabandal-gold"
                            />
                            <span className="font-medium text-gray-900">{isEn ? 'Billing address is the same as shipping' : 'A morada de faturação é igual à de envio'}</span>
                          </label>
                        </div>
                      )}

                      {(!billingSameAsShipping || !hasPhysical) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="md:col-span-2">
                            <label className={labelClass}>{isEn ? 'Billing Country *' : 'País de Faturação *'}</label>
                            <select value={billing.country} onChange={(e) => setBilling({ ...billing, country: e.target.value })} className={inputClass}>
                              {countryOptions.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>{isEn ? 'Billing Address *' : 'Morada de Faturação *'}</label>
                            <input type="text" value={billing.address1} onChange={(e) => setBilling({ ...billing, address1: e.target.value })} className={inputClass} placeholder={isEn ? 'Street, Place...' : 'Rua, Lugar...'} />
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'City *' : 'Cidade *'}</label>
                            <input type="text" value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>{isEn ? 'Postal Code / ZIP *' : 'Código Postal / CEP *'}</label>
                            <input
                              type="text"
                              value={billing.postalCode}
                              onChange={(e) => setBilling({ ...billing, postalCode: formatPostalCode(e.target.value, billing.country) })}
                              inputMode={getPostalInputMode(billing.country)}
                              className={inputClass}
                              placeholder={billingCountryMeta?.postalPlaceholder}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-6 border-t border-gray-100">
                      {sessionUserId && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="rounded border-gray-300 text-garabandal-gold focus:ring-garabandal-gold" />
                          <span className="text-sm text-gray-600">{isEn ? 'Update address in my profile' : 'Atualizar morada no meu perfil'}</span>
                        </label>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={saveCheckout} onChange={(e) => setSaveCheckout(e.target.checked)} className="rounded border-gray-300 text-garabandal-gold focus:ring-garabandal-gold" />
                        <span className="text-sm text-gray-600">{isEn ? 'Save details on this device for next time' : 'Guardar dados neste dispositivo para a próxima'}</span>
                      </label>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <h2 className="font-serif text-2xl font-bold text-garabandal-dark">{isEn ? 'Payment' : 'Pagamento'}</h2>
                    <div className="space-y-3">
                      {localizedPaymentOptions.map((option) => {
                        const active = selectedPaymentId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setSelectedPaymentId(option.id);
                              captureStoreEvent('store_payment_method_selected', {
                                ...checkoutAnalyticsBase,
                                payment_provider: option.provider,
                                payment_method: option.id,
                              });
                            }}
                            className={`w-full text-left rounded-2xl p-4 border transition-all relative overflow-hidden ${active
                              ? 'border-garabandal-gold bg-garabandal-gold/5 shadow-sm'
                              : 'border-gray-200 bg-gray-50 hover:bg-white'
                              }`}
                          >
                            {option.highlight && (
                              <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">
                                {isEn ? 'New' : 'Novo'}
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                {option.iconSrc ? (
                                  <img
                                    src={option.iconSrc}
                                    alt={option.iconAlt || option.label}
                                    className="h-6 opacity-90"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <CreditCard className="h-5 w-5 text-gray-700" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900">{option.label}</p>
                                <p className="text-sm text-gray-500">{option.description}</p>
                              </div>
                              {active && (
                                <span className="text-xs font-bold uppercase tracking-wider text-garabandal-dark bg-garabandal-gold/20 px-2 py-1 rounded-full">
                                  {isEn ? 'Selected' : 'Selecionado'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="flex items-start gap-3 text-sm text-gray-600">
                        <ShieldCheck className="w-5 h-5 text-garabandal-gold mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{isEn ? 'Secure payment' : 'Pagamento seguro'}</p>
                          <p>
                            {isEn ? 'You will be redirected to the selected payment terminal and, at the end, you will return to the confirmation page.' : 'Serás redirecionado para o terminal de pagamento selecionado e, no final, voltas para a página de confirmação.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                    <span>⚠️</span> {error}
                  </motion.div>
                )}

                {/* Navigation Actions */}
                <div className="mt-8 flex items-center gap-4">
                  {step > 1 && (
                    <button
                      onClick={previousStep}
                      className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {isEn ? 'Back' : 'Voltar'}
                    </button>
                  )}

                  <button
                    onClick={step === 3 ? handleCheckout : nextStep}
                    disabled={loading}
                    className="flex-1 bg-garabandal-gold text-garabandal-dark px-8 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                      <>
                        {step === 3 ? `${isEn ? 'Pay' : 'Pagar'} ${formatPrice(totalToPay)}` : (isEn ? 'Continue' : 'Continuar')}
                        {step !== 3 && <ChevronRight className="w-5 h-5" />}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
                <div className="p-6 sm:p-8 bg-garabandal-mist/30 border-b border-gray-100">
                  <h3 className="font-serif text-xl font-bold text-gray-900">{isEn ? 'Order Summary' : 'Resumo do Pedido'}</h3>
                </div>

                {/* Member Upsell - Only if not member */}
                {!isMemberActive && potentialMemberSavings > 0 && (
                  <div className="px-6 py-4 bg-garabandal-gold/10 border-b border-garabandal-gold/20 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-garabandal-gold rounded-full text-white mt-0.5">
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-garabandal-dark">{isEn ? 'If you were a member...' : 'Se fosses Membro...'}</p>
                        <p className="text-xs text-gray-600">{isEn ? <>You would save <span className="font-bold text-green-600">{formatPrice(potentialMemberSavings)}</span> on this purchase!</> : <>Poupavas <span className="font-bold text-green-600">{formatPrice(potentialMemberSavings)}</span> nesta compra!</>}</p>
                      </div>
                    </div>
                    <Link href={isEn ? '/en/become-member' : '/tornar-membro'} target="_blank" className="text-center text-xs font-bold uppercase tracking-wider text-garabandal-dark border border-garabandal-dark/20 rounded-lg py-2 hover:bg-white transition-colors">
                      {isEn ? 'Become a Member' : 'Tornar-me Membro'}
                    </Link>
                  </div>
                )}

                <div className="p-6 sm:p-8 space-y-4">
                  {/* Totals */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>{isEn ? 'Subtotal' : 'Subtotal'}</span>
                      <span className="font-medium text-gray-900">{formatPrice(baseSubtotal)}</span>
                    </div>
                    {promoDiscountValue > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>{isEn ? 'Garabandal books special (-15%)' : 'Especial livros Garabandal (-15%)'}</span>
                        <span className="font-bold">-{formatPrice(promoDiscountValue)}</span>
                      </div>
                    )}
                    {isMemberActive && memberDiscountValue > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>{isEn ? 'Member Discount (5%)' : 'Desconto de Membro (5%)'}</span>
                        <span className="font-bold">-{formatPrice(memberDiscountValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{isEn ? 'VAT' : 'IVA'}</span>
                      <span className="font-medium text-gray-900">{formatVatDisplay(vatTotals.vat, formatPrice)}</span>
                    </div>
                    {hasPhysical && (
                      <div className="flex justify-between text-gray-600">
                        <span>{isEn ? 'Shipping' : 'Envio'} {shippingOriginLabel && <span className="text-xs text-gray-400">({shippingOriginLabel})</span>}</span>
                        <span className="font-medium text-gray-900">
                          {shippingCost === null ? (isEn ? 'Calculated next' : 'Calculado a seguir') : shippingCost === 0 ? (isEn ? 'Free' : 'Grátis') : formatPrice(shippingCost)}
                        </span>
                      </div>
                    )}
                    {(!!savedProfile?.numero_socio || !!savedProfile?.is_membro) && (
                      <div className="mt-6 bg-gradient-to-br from-garabandal-gold/10 to-garabandal-gold/5 border border-garabandal-gold/20 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-garabandal-gold/20 flex items-center justify-center text-garabandal-gold shrink-0">
                            <Wallet className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 leading-tight">{isEn ? 'Your Wallet' : 'A Tua Carteira'}</p>
                            <p className="text-xs text-gray-600">{isEn ? 'Current balance' : 'Saldo atual'}: <span className="font-bold text-garabandal-dark">{formatPrice(storeCreditsBalance)}</span></p>
                          </div>
                        </div>

                        {storeCreditsBalance > 0 ? (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <label className="flex items-center justify-between cursor-pointer select-none group">
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${applyCredits ? 'bg-garabandal-gold border-garabandal-gold' : 'border-gray-300 group-hover:border-garabandal-gold'}`}>
                                  {applyCredits && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{isEn ? 'Use balance on this order' : 'Usar saldo na encomenda'}</span>
                              </div>
                              {applyCredits && appliedCreditsValue > 0 && (
                                <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">-{formatPrice(appliedCreditsValue)}</span>
                              )}
                              <input type="checkbox" className="hidden" checked={applyCredits} onChange={(e) => setApplyCredits(e.target.checked)} />
                            </label>
                          </div>
                        ) : (
                          <div className="bg-white/50 rounded-lg p-3 border border-garabandal-gold/10 text-center">
                            <p className="text-xs text-gray-500">{isEn ? 'No balance available to discount this purchase.' : 'Sem saldo disponível para desconto nesta compra.'}</p>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-garabandal-gold/10 flex items-start gap-3">
                          <div className="bg-garabandal-gold text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 mt-0.5">Bónus</div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {isEn ? <>Invite friends to become members and both of you earn <strong className="text-gray-900">{formatPrice(2.50)}</strong> to use here! <a href={isEn ? '/en/member' : '/member'} className="text-garabandal-gold hover:underline font-bold whitespace-nowrap">Invite friends &rarr;</a></> : <>Convida amigos a tornarem-se membros e ganhem ambos <strong className="text-gray-900">{formatPrice(2.50)}</strong> para usarem aqui! <a href="/member" className="text-garabandal-gold hover:underline font-bold whitespace-nowrap">Convidar amigos &rarr;</a></>}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-end">
                      <span className="text-lg font-bold text-gray-900">{isEn ? 'Total' : 'Total'}</span>
                      <span className="text-3xl font-serif font-bold text-garabandal-dark">{formatPrice(totalToPay)}</span>
                    </div>
                    <p className="text-right text-xs text-gray-400 mt-1">{isEn ? 'VAT included at the legal rate' : 'IVA incluído à taxa legal'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all">
                  {localizedPaymentOptions.map(opt => (
                    <div key={opt.id} title={opt.label}>
                      {opt.iconSrc ? (
                        <img src={opt.iconSrc} className="h-6 w-auto" alt={opt.label} />
                      ) : (
                        <CreditCard className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 px-4">
                {isEn ? <>By confirming the order, you agree to our{" "}<Link href="/en/terms" className="underline hover:text-gray-600">Terms and Conditions</Link>,{" "}<Link href="/en/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>,{" "}<Link href="/en/cookies" className="underline hover:text-gray-600">Cookie Policy</Link>{" "}and{" "}<Link href="/en/store/return-policy" className="underline hover:text-gray-600">Return Policy</Link>.</> : <>Ao confirmar a encomenda, concordas com os nossos{" "}<Link href="/termos" className="underline hover:text-gray-600">Termos e Condições</Link>,{" "}<Link href="/privacidade" className="underline hover:text-gray-600">Política de Privacidade</Link>,{" "}<Link href="/cookies" className="underline hover:text-gray-600">Política de Cookies</Link>{" "}e{" "}<Link href="/loja/politica-devolucao" className="underline hover:text-gray-600">Política de Devolução</Link>.</>}
              </p>
            </div>
          </div>
        </div >
      </main >

      {cartEntries.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[10000] border-t border-gray-200 bg-white/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-18px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={previousStep}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm"
                aria-label={isEn ? 'Back' : 'Voltar'}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{isEn ? 'Total' : 'Total'}</p>
              <p className="truncate text-lg font-black text-garabandal-dark">{formatPrice(totalToPay)}</p>
            </div>
            <button
              type="button"
              onClick={step === 3 ? handleCheckout : nextStep}
              disabled={loading}
              className="flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-garabandal-gold px-4 text-sm font-black text-garabandal-dark shadow-lg shadow-garabandal-gold/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  <span>{step === 3 ? (isEn ? 'Pay now' : 'Pagar agora') : (isEn ? 'Continue' : 'Continuar')}</span>
                  {step !== 3 && <ChevronRight className="h-4 w-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div >
  );
}
