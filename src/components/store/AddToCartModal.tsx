"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShoppingBag, ArrowRight, X } from 'lucide-react';
import { Product } from '../../app/loja-online/data';
import { useRouter } from 'next/navigation';
import { useCurrency } from '../providers/CurrencyProvider';
import { buildProductPath } from '../../lib/slug';
import { useLocale } from '../../contexts/LocaleContext';
import { getStoreCheckoutPath } from '../../lib/store-i18n';
import { applyStoreBookPromo } from '../../lib/store-promo';

interface AddToCartModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    variantName?: string;
    relatedProducts: Product[];
}

export default function AddToCartModal({
    isOpen,
    onClose,
    product,
    variantName,
    relatedProducts
}: AddToCartModalProps) {
    const router = useRouter();
    const { formatPrice } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const promoPrice = applyStoreBookPromo(product.price, product);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 32 }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-6 pointer-events-none"
                    >
                        <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom)]">

                            {/* Header / Success Message */}
                            <div className="bg-emerald-50 p-5 sm:p-6 flex items-start justify-between border-b border-emerald-100">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                                        >
                                            <Check className="w-6 h-6 text-emerald-600" strokeWidth={3} />
                                        </motion.div>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-emerald-900">{isEn ? 'Added to cart!' : 'Adicionado ao carrinho!'}</h2>
                                        <p className="text-emerald-700 text-sm">{isEn ? 'The item was added successfully.' : 'O artigo foi adicionado com sucesso.'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 text-emerald-700/50 hover:bg-emerald-100 hover:text-emerald-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar">
                                {/* Added Product Details */}
                                <div className="p-5 sm:p-6 flex gap-4 md:gap-6 items-center">
                                    <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-xl border border-slate-100 p-2 shrink-0">
                                        <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-serif font-bold text-slate-900 text-lg">{product.name}</h3>
                                        {variantName && (
                                            <p className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1">
                                                {isEn ? 'Option' : 'Opção'}: <span className="text-slate-900 font-bold">{variantName}</span>
                                            </p>
                                        )}
                                        <div className="mt-1 flex items-baseline gap-2">
                                            {promoPrice.active && (
                                                <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(product.price)}</span>
                                            )}
                                            <span className={`text-lg font-light ${promoPrice.active ? 'text-emerald-700' : 'text-slate-900'}`}>
                                                {formatPrice(promoPrice.discountedPrice)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="px-5 sm:px-6 flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => {
                                            onClose();
                                            router.push(getStoreCheckoutPath(locale));
                                        }}
                                        className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                                    >
                                        <ShoppingBag className="w-5 h-5" />
                                        {isEn ? 'Checkout' : 'Finalizar Compra'}
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="flex-1 bg-white border-2 border-slate-100 text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95"
                                    >
                                        {isEn ? 'Continue Shopping' : 'Continuar a Comprar'}
                                    </button>
                                </div>

                                {/* Upsell / Related */}
                                {relatedProducts.length > 0 && (
                                    <div className="mt-8 p-6 bg-slate-50 border-t border-slate-100">
                                        <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <ArrowRight className="w-4 h-4 text-amber-500" />
                                            {isEn ? 'Frequently bought together' : 'Frequentemente comprados juntos'}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {relatedProducts.slice(0, 2).map(rp => (
                                                <div
                                                    key={rp.id}
                                                    onClick={() => {
                                                        onClose();
                                                        router.push(buildProductPath(rp.id, rp.name, locale));
                                                    }}
                                                    className="group bg-white p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all cursor-pointer flex gap-3 items-center"
                                                >
                                                    <div className="w-16 h-16 bg-slate-50 rounded-lg shrink-0 p-1">
                                                        <img src={rp.image} alt={rp.name} className="w-full h-full object-contain mix-blend-multiply" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-900 truncate group-hover:text-amber-600 transition-colors">{rp.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{formatPrice(rp.price)}</p>
                                                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mt-1 block">{isEn ? 'View Details' : 'Ver Detalhes'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
