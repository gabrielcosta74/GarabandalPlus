'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { HomeCategory } from '../../lib/cms/home';

/**
 * Devotional entry grid for the homepage — the main content gateways
 * (História, Mensagens, Profecias, Testemunhos, ...). Mobile-first: single
 * column on phones, expanding to a sleek asymmetric Bento grid on larger screens.
 */
export default function DevotionalGrid({
  categories,
  locale,
}: {
  categories: HomeCategory[];
  locale: 'pt' | 'en';
}) {
  if (!categories.length) return null;
  const heading = locale === 'pt' ? 'Conhecer Garabandal' : 'Discover Garabandal';
  const sub = locale === 'pt'
    ? 'A história, as mensagens e as profecias de Nossa Senhora do Carmo em Garabandal.'
    : 'The history, messages and prophecies of Our Lady of Mount Carmel at Garabandal.';

  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] } }
  };

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-12 sm:mb-16 max-w-2xl"
      >
        <h2 className="font-serif text-4xl font-bold text-slate-900 sm:text-5xl tracking-tight mb-4">{heading}</h2>
        <p className="text-base text-slate-500 sm:text-lg leading-relaxed">{sub}</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6"
      >
        {categories.map((cat, index) => {
          // Bento layout logic for exactly 5 items
          let spanClasses = "";
          let heightClasses = "";

          if (index === 0) {
            spanClasses = "md:col-span-2 lg:col-span-4 lg:row-span-2";
            heightClasses = "min-h-[400px] sm:min-h-[450px] lg:min-h-[580px]";
          } else if (index === 1 || index === 2) {
            spanClasses = "md:col-span-1 lg:col-span-2 lg:row-span-1";
            heightClasses = "min-h-[300px] sm:min-h-[320px] lg:min-h-[280px]";
          } else if (index === 3 || index === 4) {
            spanClasses = "md:col-span-1 lg:col-span-3 lg:row-span-1";
            heightClasses = "min-h-[300px] sm:min-h-[320px] lg:min-h-[280px]";
          }

          return (
            <motion.div key={cat.key} variants={itemVariants} className={`${spanClasses} h-full`}>
              <Link
                href={cat.href}
                className={`group relative flex overflow-hidden rounded-[2rem] bg-slate-900 w-full h-full ${heightClasses} shadow-sm hover:shadow-2xl transition-shadow duration-500`}
              >
                {cat.cover && (
                  <>
                    <Image
                      src={cat.cover}
                      alt={cat.label}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
                      className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/40 to-slate-900/10" />
                  </>
                )}

                <div className="relative z-10 flex flex-col justify-end p-6 sm:p-8 w-full h-full">
                  <div className="flex items-end justify-between gap-4">
                    <div className="max-w-[85%] sm:max-w-[90%]">
                      <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3 tracking-tight group-hover:text-yellow-200 transition-colors duration-300">
                        {cat.label}
                      </h3>
                      <p className={`text-slate-200 font-medium leading-relaxed ${index === 0 ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2 sm:line-clamp-3'}`}>
                        {cat.intro}
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 transition-all duration-500 ease-out group-hover:bg-white group-hover:text-slate-950 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:border-white group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                      <ArrowRight size={20} strokeWidth={2.5} className="transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
