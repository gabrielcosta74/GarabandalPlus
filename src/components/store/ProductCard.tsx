"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Product } from '../../app/loja-online/data';
import { ShoppingCart } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
    onAddToCart: (e: React.MouseEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    onClick,
    onAddToCart,
}) => {
    const { formatPrice } = useCurrency();
    const isSoldOut = product.stock === 0;

    return (
        <motion.div
            layout
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
                <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain transform transition-transform duration-700 group-hover:scale-110 drop-shadow-sm"
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
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                                IVA incluído
                            </p>
                        </div>
                        {typeof product.stock === 'number' && product.stock > 0 && product.stock < 10 && (
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                Restam {product.stock}
                            </span>
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
};

export default ProductCard;
