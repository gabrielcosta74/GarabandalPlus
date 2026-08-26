'use client';

import { motion } from 'framer-motion';
import { HeartHandshake } from 'lucide-react';
import ScrollRevealText from './ScrollRevealText';
import { getEarlyAccessCopy, type EarlyAccessLocale } from './early-access-copy';

const FADE_UP = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function EarlyAccessMission({
  locale = 'pt',
}: {
  locale?: EarlyAccessLocale;
}) {
  const m = getEarlyAccessCopy(locale).mission;
  return (
    <section className="relative overflow-hidden px-5 py-28 text-center sm:py-40">
      {/* Warm glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 40%, rgba(188,165,107,0.16) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[36rem]">
        {/* Eyebrow */}
        <motion.p
          className="flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-[#d4bc7d]/70"
          variants={FADE_UP}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <HeartHandshake className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {m.eyebrow}
        </motion.p>

        {/* Handwritten headline, revealed on scroll */}
        <ScrollRevealText
          text={m.headline}
          className="mx-auto mt-8 max-w-[22rem] [font-family:var(--font-early-script)] text-[clamp(2.6rem,11vw,4.6rem)] font-normal leading-[1.08] text-[#f4f1e9] sm:max-w-none"
        />

        {/* Gold line */}
        <motion.div
          className="mx-auto mt-10 h-px w-16 bg-gradient-to-r from-transparent via-[#d4bc7d]/50 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Supporting copy */}
        <motion.p
          className="mx-auto mt-10 max-w-[24rem] text-[15px] leading-7 text-white/50"
          variants={FADE_UP}
          custom={0.15}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {m.body.map((seg, i) =>
            seg.strong ? (
              <span key={i} className="font-medium text-white/75">
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </motion.p>
      </div>
    </section>
  );
}
