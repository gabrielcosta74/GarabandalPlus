"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Product } from '../../app/loja-online/data';
import Link from 'next/link';
import { Globe, Eye } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';
import { inferIsDigitalProduct } from '../../lib/product-kind';
import { useLocale } from '../../contexts/LocaleContext';

interface ProductCardProps {
    product: Product;
    href?: string;
    onClick: () => void;
    onAddToCart: (e: React.MouseEvent) => void;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(({
    product,
    href,
    onClick,
    onAddToCart,
}, ref) => {
    const { formatPrice, formatEUR, currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const isDigital = inferIsDigitalProduct({
        isPhysical: product.isPhysical,
        typeId: product.type_id,
        category: product.category,
        name: product.name,
        digitalUrl: (product as any).digitalUrl,
    });

    const totalVariantStock = product.variants?.reduce((acc: number, v: any) => acc + (v.stock || 0), 0) || 0;
    const hasStock = isDigital
        ? true
        : (product.variants && product.variants.length > 0)
            ? totalVariantStock > 0
            : (product.stock === null ? true : (product.stock ?? 0) > 0);

    const isSoldOut = !isDigital && !hasStock;

    return (
        <motion.div
            layout
            ref={ref}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -6 }}
            className="group relative bg-white border border-slate-100 rounded-3xl overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all cursor-pointer flex flex-col h-full"
            onClick={onClick}
        >
            {/* Image Area */}
            <div className="relative aspect-square bg-slate-50/50 p-8 md:p-10 overflow-hidden border-b border-slate-50 group-hover:bg-slate-100/50 transition-colors">
                {product.tag && (
                    <div className="absolute top-4 left-4 z-10 bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-sm">
                        {product.tag}
                    </div>
                )}
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain transform transition-transform duration-700 group-hover:scale-105 mix-blend-multiply"
                />
            </div>

            {/* Content */}
            <div className="p-5 md:p-6 flex flex-col flex-grow">
                <h3 className="font-serif text-lg md:text-xl font-bold text-slate-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">
                    {product.name}
                </h3>
                <p className="text-slate-500 text-xs md:text-sm line-clamp-2 mb-6 flex-grow font-medium leading-relaxed">
                    {product.description}
                </p>

                <div className="mt-auto pt-5 border-t border-slate-100">
                    <div className="flex items-end justify-between mb-5">
                        <div>
                            <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                {formatEUR(product.price)}
                            </p>
                            {currency !== 'EUR' && (
                                <p className="text-base text-slate-500 font-semibold mt-0.5">
                                    ≈ {formatPrice(product.price)}
                                </p>
                            )}
                            <div className="flex flex-col gap-1.5 mt-1">
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                    {isEn ? 'VAT included' : 'IVA incluído'}
                                </p>
                                {product.allowedCountries && product.allowedCountries.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-600 bg-slate-100 px-2 py-1 rounded-md w-fit" title={product.allowedCountries.join(', ')}>
                                        <Globe size={10} className="text-slate-400" />
                                        <span className="font-bold uppercase tracking-widest">
                                            {product.allowedCountries.length === 1
                                                ? (isEn ? 'Restricted Shipping' : 'Envio Restrito')
                                                : (isEn ? 'Limited Shipping' : 'Envio Limitado')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isDigital && typeof product.stock === 'number' && product.stock > 0 && product.stock < 10 && (
                            <span className="text-[9px] text-red-600 font-black uppercase tracking-[0.1em] bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                                {isEn ? 'Only' : 'Restam'} {product.stock}
                            </span>
                        )}
                        {/* Show if it has variants/sizes available */}
                        {product.variants && product.variants.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1 max-w-[50%]">
                                {product.variants.slice(0, 3).map((v: any) => (
                                    <span key={v.sku} className="text-[9px] text-slate-600 font-bold uppercase bg-slate-100 px-2 py-1 rounded-md">
                                        {v.name}
                                    </span>
                                ))}
                                {product.variants.length > 3 && (
                                    <span className="text-[10px] text-slate-400 font-bold px-1">+</span>
                                )}
                            </div>
                        )}
                    </div>

                    {href && !isSoldOut ? (
                        <Link
                            href={href}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart(e);
                            }}
                            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center transition-all cursor-pointer bg-yellow-400 text-slate-900 hover:bg-slate-900 hover:text-white shadow-md hover:shadow-lg"
                        >
                            <span>{isEn ? 'View Product' : 'Ver Produto'}</span>
                        </Link>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart(e);
                            }}
                            disabled={isSoldOut}
                            className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center transition-all shadow-sm cursor-pointer
                            ${isSoldOut
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-yellow-400 text-slate-900 hover:bg-slate-900 hover:text-white hover:shadow-lg'
                                }
                        `}
                        >
                            <span>
                                {isSoldOut ? (
                                    isEn ? 'Out of Stock' : 'Esgotado'
                                ) : (
                                    isEn ? 'View Product' : 'Ver Produto'
                                )}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
