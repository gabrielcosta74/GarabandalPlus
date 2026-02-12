"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Product } from '../../app/loja-online/data';
import { ShoppingCart, Globe } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
    onAddToCart: (e: React.MouseEvent) => void;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(({
    product,
    onClick,
    onAddToCart,
}, ref) => {
    const { formatPrice } = useCurrency();
    const totalVariantStock = product.variants?.reduce((acc: number, v: any) => acc + (v.stock || 0), 0) || 0;
    const hasStock = (product.variants && product.variants.length > 0)
        ? totalVariantStock > 0
        : (product.stock === null ? true : (product.stock ?? 0) > 0);

    // Digital products are never sold out unless explicitly inactive (which they wouldn't be here)
    const isDigital = product.type_id?.includes('book_digital') || product.type_id === 'digital_generic' || product.type === 'digital';
    const isSoldOut = !isDigital && !hasStock;

    return (
        <motion.div
            layout
            ref={ref}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -8 }}
            className="group relative bg-[#ffffff] border border-gray-200/60 rounded-3xl overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all cursor-pointer flex flex-col h-full"
            onClick={onClick}
        >
            {/* Image Area - Subtle gray background to contrast with white card */}
            <div className="relative aspect-square bg-gray-50/80 p-8 overflow-hidden border-b border-gray-100 group-hover:bg-gray-100/50 transition-colors">
                {product.tag && (
                    <div className="absolute top-4 left-4 z-10 bg-garabandal-gold text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                        {product.tag}
                    </div>
                )}
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain transform transition-transform duration-700 group-hover:scale-110 drop-shadow-sm"
                />
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col flex-grow">
                <h3 className="font-serif text-xl text-garabandal-dark mb-2 group-hover:text-garabandal-gold transition-colors line-clamp-2 leading-tight">
                    {product.name}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-6 flex-grow font-normal leading-relaxed">
                    {product.description}
                </p>

                <div className="mt-auto pt-4 border-t border-gray-50">
                    <div className="flex items-end justify-between mb-5">
                        <div>
                            <p className="text-2xl font-medium text-garabandal-dark tracking-tight">
                                {formatPrice(product.price)}
                            </p>
                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                                    IVA incluído
                                </p>
                                {product.allowedCountries && product.allowedCountries.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit" title={product.allowedCountries.join(', ')}>
                                        <Globe size={10} />
                                        <span className="font-bold uppercase tracking-wide">
                                            {product.allowedCountries.length === 1 ? 'Envio Restrito' : 'Envio Limitado'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {typeof product.stock === 'number' && product.stock > 0 && product.stock < 10 && (
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                Restam {product.stock}
                            </span>
                        )}
                        {/* Show if it has variants/sizes available */}
                        {product.variants && product.variants.length > 0 && (
                            <div className="flex gap-1">
                                {product.variants.slice(0, 3).map((v: any) => (
                                    <span key={v.sku} className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {v.name}
                                    </span>
                                ))}
                                {product.variants.length > 3 && (
                                    <span className="text-[10px] text-slate-400 font-bold px-1">+</span>
                                )}
                            </div>
                        )}
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onAddToCart}
                        disabled={isSoldOut}
                        className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm
                        ${isSoldOut
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-garabandal-dark text-white hover:bg-black hover:shadow-lg'
                            }
                    `}
                    >
                        {isSoldOut ? (
                            'Esgotado'
                        ) : (
                            <>
                                <ShoppingCart size={16} />
                                Adicionar
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
