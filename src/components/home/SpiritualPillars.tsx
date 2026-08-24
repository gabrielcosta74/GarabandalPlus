'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Flame, MessageCircle, Sparkles, Users } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

const SpiritualPillars = () => {
  const { t, locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="bg-white pb-24 md:pb-32">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="border-t border-slate-100 pt-20 md:pt-24">
          <div className="mb-12 max-w-2xl md:mb-14">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              {isEn ? 'Walk with us' : 'Caminhe connosco'}
            </p>
            <h2 className="font-serif text-4xl leading-[1.1] tracking-tight text-slate-900 md:text-5xl">
              {isEn ? 'A place for prayer and belonging.' : 'Um lugar para a oração e para pertencer.'}
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-8 md:p-10"
            >
              <div className="absolute inset-0 bg-[url('/images/padrerezar.webp')] bg-cover bg-center opacity-70 transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/20" />
              <div className="relative z-10 flex h-full flex-col items-start">
                <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-amber-300 backdrop-blur-sm">
                  <Flame className="h-5 w-5" aria-hidden />
                </div>
                <div className="max-w-md">
                  <h3 className="font-serif text-3xl leading-tight text-white md:text-4xl">
                    {isEn
                      ? <>Prayer <span className="italic text-amber-300">Network</span></>
                      : <>Rede de <span className="italic text-amber-300">Oração</span></>}
                  </h3>
                  <p className="mt-5 max-w-sm leading-relaxed text-slate-200">
                    {isEn
                      ? 'Add your intentions to our worldwide chain of prayer.'
                      : 'Junte as suas intenções à nossa corrente mundial de oração.'}
                  </p>
                </div>
                <Link href={t.urls.intentions} className="group/button mt-10 inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 font-serif text-base font-bold text-slate-950 shadow-lg shadow-black/20 transition-all hover:bg-amber-300 hover:shadow-xl">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {isEn ? 'Send Intention' : 'Enviar Intenção'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-1" aria-hidden />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-8 md:p-10"
            >
              <div className="absolute inset-0 bg-[url('/images/associacao.webp')] bg-cover bg-center opacity-65 transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/25" />
              <div className="relative z-10 flex h-full flex-col items-start">
                <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm">
                  <Users className="h-5 w-5" aria-hidden />
                </div>
                <div className="max-w-md">
                  <h3 className="font-serif text-3xl leading-tight text-white md:text-4xl">
                    {isEn
                      ? <>Apostolate <span className="italic text-amber-300">Members</span></>
                      : <>Membros do <span className="italic text-amber-300">Apostolado</span></>}
                  </h3>
                  <p className="mt-5 max-w-sm leading-relaxed text-slate-200">
                    {isEn
                      ? 'Join a spiritual family that keeps the Apostolate’s mission alive.'
                      : 'Junte-se à família espiritual que mantém viva a missão do Apostolado.'}
                  </p>
                </div>
                <Link href={t.urls.becomeMember} className="group/button mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-serif text-base font-bold text-slate-950 shadow-lg shadow-black/20 transition-all hover:bg-amber-50 hover:shadow-xl">
                  <Sparkles className="h-4 w-4 text-amber-700" aria-hidden />
                  {isEn ? 'Become an Official Member' : 'Ser Membro Oficial'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-1" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpiritualPillars;
