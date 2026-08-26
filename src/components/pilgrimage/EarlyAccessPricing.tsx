'use client';

import { motion } from 'framer-motion';
import { BadgePercent, Flame } from 'lucide-react';
import ScrollRevealText from './ScrollRevealText';

const FADE_UP = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function EarlyAccessPricing() {
  return (
    <section className="relative overflow-hidden px-5 py-28 text-center sm:py-40">
      {/* Subtle gold glow behind pricing */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 38%, rgba(188,165,107,0.16) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[36rem]">
        {/* Eyebrow */}
        <motion.p
          className="text-[12px] font-semibold uppercase tracking-[0.3em] text-[#d4bc7d]/70"
          variants={FADE_UP}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          Oportunidade única
        </motion.p>

        {/* Imposing handwritten phrase — revealed word by word on scroll */}
        <ScrollRevealText
          text="Um valor abaixo do mercado"
          className="mx-auto mt-8 max-w-[20rem] [font-family:var(--font-early-script)] text-[clamp(3rem,13vw,5.5rem)] font-normal leading-[1.05] text-[#f4f1e9] sm:max-w-none"
        />

        {/* Discount badges */}
        <motion.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          variants={FADE_UP}
          custom={0.15}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d4bc7d]/25 bg-[#d4bc7d]/[0.07] px-4 py-2 text-[12px] font-medium tracking-wide text-[#e8cf8a]">
            <BadgePercent className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Preço exclusivo
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d4bc7d]/25 bg-[#d4bc7d]/[0.07] px-4 py-2 text-[12px] font-medium tracking-wide text-[#e8cf8a]">
            <BadgePercent className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Abaixo do mercado
          </span>
        </motion.div>

        {/* Gold line */}
        <motion.div
          className="mx-auto mt-12 h-px w-16 bg-gradient-to-r from-transparent via-[#d4bc7d]/50 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Price cards */}
        <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:gap-6">
          {/* Terrestre */}
          <motion.div
            className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-9"
            variants={FADE_UP}
            custom={0.25}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
              Peregrinação terrestre
            </p>
            <p className="mt-4 [font-family:var(--font-early-serif)] text-[3.4rem] font-medium leading-none text-[#f4f1e9] sm:text-[3.8rem]">
              1.850<span className="text-[1.6rem] text-white/40">€</span>
            </p>
            <p className="mt-3 text-[13px] leading-5 text-white/40">
              Quarto duplo · por pessoa
            </p>
          </motion.div>

          {/* Taxa */}
          <motion.div
            className="flex-1 rounded-2xl border border-[#d4bc7d]/15 bg-[#d4bc7d]/[0.04] px-6 py-9"
            variants={FADE_UP}
            custom={0.35}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#d4bc7d]/60">
              Taxa de inscrição
            </p>
            <p className="mt-4 [font-family:var(--font-early-serif)] text-[3.4rem] font-medium leading-none text-[#f0cc70] sm:text-[3.8rem]">
              500<span className="text-[1.6rem] text-[#d4bc7d]/50">€</span>
            </p>
            <p className="mt-3 text-[13px] leading-5 text-[#d4bc7d]/50">
              Garante a sua vaga
            </p>
          </motion.div>
        </div>

        {/* Scarcity — prominent, imposing */}
        <motion.div
          className="mt-14 flex flex-col items-center gap-5"
          variants={FADE_UP}
          custom={0.5}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {/* Big scarcity banner */}
          <span className="inline-flex items-center gap-3 rounded-full border border-[#e0864a]/40 bg-[#e0864a]/[0.1] px-7 py-4 text-[clamp(1rem,4.5vw,1.35rem)] font-semibold uppercase tracking-[0.14em] text-[#f4a361] shadow-[0_0_40px_-8px_rgba(224,134,74,0.4)]">
            <Flame className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden="true" />
            Vagas limitadas
          </span>

          {/* Highly sought after */}
          <span className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.24em] text-white/45">
            Altamente procurado
          </span>
        </motion.div>

        {/* Bottom note */}
        <motion.p
          className="mx-auto mt-14 max-w-[23rem] text-[15px] leading-7 text-white/45"
          variants={FADE_UP}
          custom={0.6}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          14 dias pelos maiores santuários da Europa a um valor abaixo do
          mercado — possível por sermos uma{' '}
          <span className="font-medium text-white/70">
            Associação sem fins lucrativos
          </span>
          .
        </motion.p>

        {/* Gold line */}
        <motion.div
          className="mx-auto mt-14 h-px w-16 bg-gradient-to-r from-transparent via-[#d4bc7d]/50 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.7 }}
        />
      </div>
    </section>
  );
}
