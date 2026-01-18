'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { MEMBER_IMAGE_URL } from '../home/constants';

const StoreHero: React.FC = () => {
    return (
        <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-90"
                style={{ backgroundImage: `url(${MEMBER_IMAGE_URL})` }}
            />
            {/* Light Overlay */}
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-garabandal-mist via-white/20 to-transparent" />

            <div className="relative z-10 text-center px-6 max-w-4xl mx-auto mt-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 text-garabandal-dark border border-garabandal-dark/10 bg-white/50 px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold mb-6 backdrop-blur-md shadow-sm">
                        <ShoppingBag size={14} className="text-garabandal-gold" />
                        <span>Loja Oficial</span>
                    </div>

                    <h1 className="font-serif text-5xl md:text-7xl text-garabandal-dark mb-6 tracking-tight">
                        Artigos de Devoção
                    </h1>

                    <p className="text-garabandal-dark/70 text-lg font-light max-w-2xl mx-auto leading-relaxed">
                        Adquira materiais oficiais do Apostolado de Garabandal.
                        Cada compra ajuda a sustentar a nossa missão.
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default StoreHero;
