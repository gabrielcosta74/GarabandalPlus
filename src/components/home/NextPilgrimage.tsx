'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import { parseCivilDate } from '../../lib/utils';
import { useLocale } from '../../contexts/LocaleContext';

interface Pilgrimage {
    id: string;
    title: string;
    slug: string;
    cover_image: string;
    start_date: string;
    description: string;
    base_price: number;
    itinerary_summary?: string;
}

interface NextPilgrimageProps {
    nextPilgrimage?: Pilgrimage | null;
}

const NextPilgrimage: React.FC<NextPilgrimageProps> = ({ nextPilgrimage }) => {
    const { t, locale } = useLocale();
    const isEn = locale === 'en';

    if (!nextPilgrimage) return null;

    const dateLocale = isEn ? enUS : pt;
    const formattedDate = isEn
        ? format(parseCivilDate(nextPilgrimage.start_date), "MMMM d, yyyy", { locale: dateLocale })
        : format(parseCivilDate(nextPilgrimage.start_date), "d 'de' MMMM, yyyy", { locale: dateLocale });

    const pilgrimagesHref = t.urls.pilgrimages;
    const cardHref = `${pilgrimagesHref}#${nextPilgrimage.slug}`;

    return (
        <section className="relative py-24 bg-slate-50 overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -left-[10%] top-[20%] w-[40vw] h-[40vw] rounded-full bg-garabandal-gold/5 blur-3xl" />
                <div className="absolute -right-[10%] bottom-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-900/5 blur-3xl" />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="inline-block py-2 px-4 mb-6 bg-garabandal-dark/5 border border-garabandal-dark/10 rounded-full text-garabandal-dark text-[10px] font-bold tracking-[0.2em] uppercase">
                            {isEn ? 'Next Spiritual Journey' : 'Próxima Jornada Espiritual'}
                        </span>
                        <h2 className="font-serif text-4xl md:text-5xl text-slate-900 mb-6 leading-tight">
                            {isEn ? 'Apostolate Pilgrimages' : 'Peregrinações do Apostolado'}
                        </h2>
                        <p className="text-lg text-slate-600 font-light leading-relaxed max-w-2xl mx-auto">
                            {isEn
                                ? 'Garabandal is not just a place — it is an encounter. Prepare your heart for our next pilgrimage and experience moments of prayer, peace and conversion.'
                                : 'Garabandal não é apenas um lugar, é um encontro. Prepare o seu coração para a nossa próxima peregrinação e viva momentos de oração, paz e conversão.'}
                        </p>
                    </motion.div>
                </div>

                {/* Pilgrimage Card */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="max-w-5xl mx-auto"
                >
                    <div className="group relative bg-white rounded-[2.5rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] transition-all duration-500 overflow-hidden border border-slate-100">
                        <div className="flex flex-col md:flex-row min-h-[500px]">
                            {/* Image Section */}
                            <div className="w-full md:w-1/2 h-72 md:h-auto relative overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-slate-200">
                                    <Image
                                        src={nextPilgrimage.cover_image || '/images/pilgrimage-placeholder.jpg'}
                                        alt={nextPilgrimage.title}
                                        fill
                                        sizes="(min-width: 1024px) 50vw, 100vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />

                                <div className="absolute top-8 left-8 bg-white/95 backdrop-blur-sm py-3 px-5 rounded-2xl shadow-lg">
                                    <div className="flex items-center gap-2 text-garabandal-dark font-bold">
                                        <Calendar className="w-5 h-5 text-garabandal-gold" />
                                        <span>{formattedDate}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white relative">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-garabandal-gold/0 via-garabandal-gold/50 to-garabandal-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <h3 className="font-serif text-3xl md:text-4xl text-slate-900 mb-6 leading-tight group-hover:text-garabandal-dark transition-colors">
                                    {nextPilgrimage.title}
                                </h3>

                                <p className="text-slate-500 leading-relaxed mb-8 line-clamp-3">
                                    {nextPilgrimage.description || (isEn
                                        ? "Join us for this unique experience of faith and devotion. A complete programme designed for your spiritual growth."
                                        : "Junte-se a nós nesta experiência única de fé e devoção. Um programa completo pensado para o seu crescimento espiritual.")}
                                </p>

                                <div className="space-y-4 mb-10">
                                    <div className="flex items-center gap-4 text-slate-700">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-garabandal-gold shrink-0">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm uppercase tracking-wider text-slate-400">{isEn ? 'Itinerary' : 'Roteiro'}</p>
                                            <p className="font-medium">{nextPilgrimage.itinerary_summary || 'S. Sebastião de Garabandal'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-700">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-garabandal-gold shrink-0">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm uppercase tracking-wider text-slate-400">{isEn ? 'Spots' : 'Vagas'}</p>
                                            <p className="font-medium">{isEn ? 'Limited and exclusive' : 'Limitadas e exclusivas'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                                    <Link
                                        href={cardHref}
                                        className="flex-1 bg-garabandal-dark text-white py-4 px-8 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-900 transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg shadow-garabandal-dark/20"
                                    >
                                        {isEn ? 'View Programme' : 'Ver Programa'}
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                    <Link
                                        href={pilgrimagesHref}
                                        className="px-8 py-4 rounded-xl border border-slate-200 text-black font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors text-center !text-black"
                                        style={{ color: 'black' }}
                                    >
                                        {isEn ? 'All Dates' : 'Todas as Datas'}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default NextPilgrimage;
