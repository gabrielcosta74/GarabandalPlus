"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, CheckCircle2 } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useLocale } from '../../contexts/LocaleContext';

type Testimonial = {
    id: string;
    author_name: string;
    role: string;
    role_en?: string | null;
    text: string;
    text_en?: string | null;
    image_url: string;
    display_order: number;
};

export function PilgrimageTestimonials() {
    const { locale, t: tr } = useLocale();
    const isEn = locale === 'en';
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTestimonials = async () => {
            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('testimonials')
                .select('*')
                .order('display_order');

            if (data) {
                setTestimonials(data);
            }
            setLoading(false);
        };

        fetchTestimonials();
    }, []);

    if (loading) return null;
    if (testimonials.length === 0) return null;

    const shouldAnimate = testimonials.length > 2;
    // Tripular the list for smoother infinite loop
    const displayList = shouldAnimate ? [...testimonials, ...testimonials, ...testimonials] : testimonials;

    return (
        <section className="mb-8 overflow-hidden relative">
            {/* Section Header */}
            <div className="mb-6 px-6 max-w-7xl mx-auto">
                <h2 className="text-2xl font-serif font-bold text-slate-900">{tr.pilgrimages.testimonials}</h2>
            </div>

            {/* Marquee Container */}
            <div className="relative w-full py-4">
                {/* Gradient Masks */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#f8fafc] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#f8fafc] to-transparent z-10 pointer-events-none" />

                <div className="flex overflow-hidden">
                    <motion.div
                        className="flex gap-5 px-4"
                        animate={shouldAnimate ? {
                            x: ["0%", "-33.33%"] // Move exactly one set of items
                        } : {}}
                        style={{ width: "fit-content" }}
                        transition={shouldAnimate ? {
                            repeat: Infinity,
                            ease: "linear",
                            duration: 40, // Slower, smoother scroll
                        } : {}}
                    >
                        {displayList.map((t, i) => {
                            const testimonialText = isEn ? t.text_en || t.text : t.text;
                            const role = isEn ? t.role_en || t.role : t.role;

                            return (
                                <div
                                key={`${t.id}-${i}`}
                                className="w-[320px] bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex-shrink-0 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group"
                            >
                                {/* Header: Author Info */}
                                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 p-0.5 border border-slate-200">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                                            {t.image_url ? (
                                                <img src={t.image_url} alt={t.author_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-slate-400 font-bold text-xs">{t.author_name.charAt(0)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-900 text-sm truncate">{t.author_name}</h4>
                                        <div className="flex items-center gap-2">
                                            <div className="flex">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                                                ))}
                                            </div>
                                            {role && (
                                                <span className="text-[10px] items-center gap-1 text-slate-400 font-medium uppercase tracking-wider hidden sm:flex">
                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                                    {role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Body: Text */}
                                <div className="relative">
                                    <p className="text-slate-600 text-[13px] leading-[1.6] line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
                                        <span className="text-indigo-300 font-serif text-lg leading-none mr-1">"</span>
                                        {testimonialText}
                                        <span className="text-indigo-300 font-serif text-lg leading-none ml-1">"</span>
                                    </p>
                                </div>
                            </div>
                            );
                        })}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
