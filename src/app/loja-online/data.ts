export type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  tag?: string;
  category?: string | null;
  description: string;
  format: string;
  isPhysical: boolean;
  digitalUrl?: string | null;
  stock?: number | null;
  allowedCountries?: string[] | null;
  taxRate?: number;
  specifications?: any;
  variants?: any[];
  categoryId?: string | null;
  is_physical?: boolean;
  type?: 'fisico' | 'digital';
  type_id?: string;
  metadata?: Record<string, any>;
};

export type CartItem = {
  id: string;
  qty: number;
  variantId?: string;
  variantName?: string;
};

export const loadCart = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('store:cart');
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCart = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('store:cart', JSON.stringify(items));
  window.dispatchEvent(new Event('cart:updated'));
};

export const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);
