"use client";

import React from 'react';
import Image from 'next/image';
import { Product } from '../../app/loja-online/data';
import Link from 'next/link';
import { ArrowRight, Check, Globe, ShoppingCart } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';
import { inferIsDigitalProduct } from '../../lib/product-kind';
import { useLocale } from '../../contexts/LocaleContext';
import { applyStoreBookPromo } from '../../lib/store-promo';

interface ProductCardProps {
    product: Product;
    href?: string;
    priority?: boolean;
    onClick: () => void;
    onAddToCart: (e: React.MouseEvent) => void;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(({
    product,
    href,
    priority = false,
    onClick,
    onAddToCart,
}, ref) => {
    const { formatPrice, formatEUR, currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [justAdded, setJustAdded] = React.useState(false);
    const promoPrice = applyStoreBookPromo(product.price, product);
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
    const hasVariants = !!(product.variants && product.variants.length > 0);

    // Simple products (no variants) can be added straight to the cart.
    // Products with variants go to the product page so the user picks an option.
    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToCart(e);
        setJustAdded(true);
        window.setTimeout(() => setJustAdded(false), 1300);
    };

    const handleViewOptions = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };

    return (
        <div
            ref={ref}
            role="link"
            tabIndex={0}
            aria-label={isEn ? `View ${product.name}` : `Ver ${product.name}`}
            className="group relative bg-white border border-slate-100 rounded-3xl overflow-hidden hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all cursor-pointer flex flex-col h-full"
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter') onClick();
            }}
        >
            {/* Image Area */}
            <div className="relative aspect-square bg-slate-50/50 p-8 md:p-10 overflow-hidden border-b border-slate-50 group-hover:bg-slate-100/50 transition-colors">
                {product.tag && (
                    <div className="absolute top-4 left-4 z-10 bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-sm">
                        {product.tag}
                    </div>
                )}
                {promoPrice.active && (
                    <div className="absolute top-4 right-4 z-10 rounded-full bg-garabandal-gold px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-sm">
                        -15% {isEn ? 'today' : 'hoje'}
                    </div>
                )}
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    priority={priority}
                    fetchPriority={priority ? 'high' : 'auto'}
                    sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain transform transition-transform duration-700 group-hover:scale-105 mix-blend-multiply"
                />
            </div>

            {/* Content */}
            <div className="p-5 md:p-6 flex flex-col flex-grow">
                <h3 className="font-serif text-lg md:text-xl font-bold text-slate-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug flex-grow">
                    {product.name}
                </h3>

                <div className="mt-auto pt-5 border-t border-slate-100">
                    <div className="flex items-end justify-between mb-5">
                        <div>
                            {promoPrice.active && (
                                <p className="mb-0.5 text-xs font-bold text-slate-400 line-through">
                                    {formatEUR(product.price)}
                                </p>
                            )}
                            <p className={`text-lg md:text-xl font-black tracking-tight ${promoPrice.active ? 'text-emerald-700' : 'text-slate-900'}`}>
                                {formatEUR(promoPrice.discountedPrice)}
                            </p>
                            {currency !== 'EUR' && (
                                <p className="text-sm text-slate-500 font-semibold mt-0.5">
                                    ≈ {formatPrice(promoPrice.discountedPrice)}
                                </p>
                            )}
                            <div className="flex flex-col gap-1.5 mt-1">
                                {promoPrice.active && (
                                    <p className="text-[10px] text-emerald-700 uppercase tracking-widest font-black">
                                        {isEn ? 'Special edition' : 'Edição especial'}
                                    </p>
                                )}
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

                    {isSoldOut ? (
                        <button
                            disabled
                            className="w-full py-2 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                            <span>{isEn ? 'Out of Stock' : 'Esgotado'}</span>
                        </button>
                    ) : hasVariants ? (
                        href ? (
                        <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full py-2 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-slate-900 text-white hover:bg-amber-500 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                            <span>{isEn ? 'Choose option' : 'Escolher opção'}</span>
                            <ArrowRight size={13} strokeWidth={2.5} />
                        </Link>
                        ) : (
                            <button
                                onClick={handleViewOptions}
                                className="w-full py-2 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-slate-900 text-white hover:bg-amber-500 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                            >
                                <span>{isEn ? 'Choose option' : 'Escolher opção'}</span>
                                <ArrowRight size={13} strokeWidth={2.5} />
                            </button>
                        )
                    ) : (
                        <button
                            onClick={handleQuickAdd}
                            className={`w-full py-2 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 ${
                                justAdded
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                    : 'bg-slate-900 text-white hover:bg-amber-500'
                            }`}
                        >
                            {justAdded ? (
                                <>
                                    <Check size={13} strokeWidth={3} />
                                    <span>{isEn ? 'Added' : 'Adicionado'}</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingCart size={13} strokeWidth={2.5} />
                                    <span>{isEn ? 'Add' : 'Adicionar'}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
