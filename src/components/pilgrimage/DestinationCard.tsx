'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

type DestinationCardProps = {
  name: string;
  country: string;
  imageUrl: string;
  highlight?: boolean;
  priority?: boolean;
};

export default function DestinationCard({
  name,
  country,
  imageUrl,
  highlight = false,
  priority = false,
}: DestinationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });
  const photoY = useTransform(scrollYProgress, [0, 1], ['8%', '-8%']);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
      className={`relative w-full overflow-hidden ${
        highlight
          ? 'aspect-[3/4.2] sm:aspect-[16/10] border border-[#d4bc7d]/30'
          : 'aspect-[3/4] sm:aspect-[16/10]'
      }`}
    >
      {/* Parallax photo */}
      <motion.div
        className="absolute inset-[-10%] z-0"
        style={{ y: photoY }}
      >
        <Image
          src={imageUrl}
          alt={name}
          fill
          priority={priority}
          sizes="100vw"
          quality={85}
          className="object-cover"
        />
      </motion.div>

      {/* Bottom gradient */}
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_30%,rgba(8,8,8,0.15)_50%,rgba(8,8,8,0.7)_80%,rgba(8,8,8,0.92)_100%)]" />

      {/* Text overlay */}
      <div className="absolute inset-x-0 bottom-0 z-[2] px-6 pb-8 sm:px-10 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#d4bc7d]/70">
            {country}
          </p>
          <h3
            className={`mt-1.5 [font-family:var(--font-early-serif)] font-medium leading-none text-[#f4f1e9] ${
              highlight ? 'text-[2.6rem] sm:text-[3.4rem]' : 'text-[2.2rem] sm:text-[3rem]'
            }`}
          >
            {name}
          </h3>
          <motion.div
            className={`mt-3 h-px bg-[#d4bc7d] ${highlight ? 'w-16' : 'w-10'}`}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
            style={{ originX: 0 }}
          />
        </motion.div>
      </div>

      {/* Highlight glow for Garabandal */}
      {highlight && (
        <div className="pointer-events-none absolute inset-0 z-[1] rounded-sm ring-1 ring-inset ring-[#d4bc7d]/15" />
      )}
    </motion.div>
  );
}
