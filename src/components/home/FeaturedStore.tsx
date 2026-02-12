'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildProductPath } from '../../lib/slug';

type FeaturedProduct = {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    category?: string | null;
    isPhysical: boolean;
};

export default function FeaturedStore({ products }: { products: FeaturedProduct[] }) {
    if (!products || products.length === 0) return null;

    const formatPrice = (val: number) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <section className="relative py-24 bg-garabandal-dark overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#1e293b] via-garabandal-dark to-garabandal-dark opacity-50" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
                    <h2 className="font-serif text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200">
                        Artigos do Apostolado
                    </h2>
                    <p className="text-lg text-slate-300 font-light leading-relaxed">
                        Ao adquirir estes artigos, você não apenas fortalece a sua fé,
                        mas também sustenta a nossa missão de levar a mensagem de Garabandal a mais corações.
                    </p>
                    <div className="pt-2">
                        <Link
                            href="/loja-online"
                            className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400 font-bold uppercase tracking-widest text-sm transition-colors group"
                        >
                            Ver Loja Completa
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {products.slice(0, 4).map((product, idx) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/10"
                        >
                            {/* Image */}
                            <div className="aspect-[4/5] relative overflow-hidden bg-slate-800">
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="(min-width: 1024px) 18vw, (min-width: 768px) 25vw, 50vw"
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-60" />
                            </div>

                            {/* Content */}
                            <div className="absolute inset-x-0 bottom-0 p-4">
                                <div className="space-y-1 mb-2">
                                    <p className="text-xs font-bold text-yellow-500 uppercase tracking-wider line-clamp-1">
                                        {product.category || (product.isPhysical ? 'Devoção' : 'Digital')}
                                    </p>
                                    <h3 className="font-serif text-lg text-white leading-tight line-clamp-2 min-h-[1.5em] drop-shadow-md">
                                        {product.name}
                                    </h3>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-3">
                                    <span className="text-white font-bold tracking-tight text-lg">
                                        {formatPrice(product.price)}
                                    </span>
                                    <Link
                                        href={buildProductPath(product.id, product.name)}
                                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-yellow-500 hover:text-slate-900 transition-colors backdrop-blur-md"
                                        aria-label="Ver Produto"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
