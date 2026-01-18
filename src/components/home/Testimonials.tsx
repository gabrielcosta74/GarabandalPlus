'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TESTIMONIALS } from './constants';
import { Quote } from 'lucide-react';

const Testimonials: React.FC = () => {
    return (
        <section id="testimonials" className="py-24 bg-[#080c17] border-t border-white/5">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 max-w-5xl mx-auto">
                    {TESTIMONIALS.map((t, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 }}
                            className="relative"
                        >
                            <Quote className="text-garabandal-gold/20 absolute -top-4 -left-6 transform -scale-x-100" size={60} />
                            <p className="font-serif text-xl md:text-2xl text-white/90 leading-relaxed italic mb-6">
                                "{t.text}"
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="h-px w-12 bg-garabandal-gold/50" />
                                <span className="text-xs uppercase tracking-widest text-white/50">{t.author}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Final CTA in Footer area essentially */}
                <div className="text-center mt-24">
                    <p className="text-white/40 text-sm uppercase tracking-widest mb-6">Junte-se à nossa missão de fé</p>
                    <h2 className="font-serif text-3xl text-white mb-8">Nossa Senhora conta convosco.</h2>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
