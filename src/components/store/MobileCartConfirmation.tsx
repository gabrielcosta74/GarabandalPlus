"use client";

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ShoppingBag, X } from 'lucide-react';
import { Product } from '../../app/loja-online/data';
import { useCurrency } from '../providers/CurrencyProvider';
import { useLocale } from '../../contexts/LocaleContext';

type MobileCartConfirmationProps = {
  isOpen: boolean;
  product: Product | null;
  cartCount: number;
  checkoutHref: string;
  onClose: () => void;
};

export default function MobileCartConfirmation({
  isOpen,
  product,
  cartCount,
  checkoutHref,
  onClose,
}: MobileCartConfirmationProps) {
  const { formatPrice } = useCurrency();
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <AnimatePresence>
      {isOpen && product && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-[10000] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 md:inset-x-auto md:right-5 md:bottom-5 md:w-[390px] md:p-0"
        >
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_-12px_35px_-18px_rgba(15,23,42,0.45)] md:shadow-2xl">
            <div className="flex items-start gap-3 p-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-5 w-5" strokeWidth={3} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900">
                  {isEn ? 'Added to cart' : 'Adicionado ao carrinho'}
                </p>
                <p className="truncate text-xs font-semibold text-slate-500">{product.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {cartCount} {cartCount === 1 ? (isEn ? 'item' : 'artigo') : (isEn ? 'items' : 'artigos')} · {formatPrice(product.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isEn ? 'Close confirmation' : 'Fechar confirmação'}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 p-2 sm:grid sm:grid-cols-[1fr_auto]">
              <Link
                href={checkoutHref}
                style={{ color: '#fff' }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] md:hover:bg-slate-800"
              >
                <ShoppingBag className="h-4 w-4" />
                {isEn ? 'Checkout' : 'Finalizar compra'}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-100 sm:min-h-12"
              >
                {isEn ? 'Keep shopping' : 'Continuar'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
