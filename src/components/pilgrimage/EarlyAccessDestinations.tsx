'use client';

import { motion } from 'framer-motion';
import DestinationCard from './DestinationCard';
import { getEarlyAccessCopy, type EarlyAccessLocale } from './early-access-copy';

const DESTINATIONS = [
  {
    name: 'Santarém',
    country: 'Portugal',
    imageUrl: 'https://portugaltravelguide.com/wp-content/uploads/2019/12/santarm_main.jpg',
  },
  {
    name: 'Fátima',
    country: 'Portugal',
    imageUrl: 'https://www.impulsiveaddiction.com/wp-content/uploads/2022/04/santuario-de-fatima-1-1.jpg',
  },
  {
    name: 'Ávila',
    country: 'Espanha',
    imageUrl: 'https://www.civitatis.com/blog/wp-content/uploads/2023/01/que-ver-avila.jpg',
  },
  {
    name: 'Garabandal',
    country: 'Espanha',
    highlight: true,
    imageUrl:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200003152-b6916b6919/IMG-20180719-WA0022.webp?ph=7a8de8e761',
  },
  {
    name: 'Lourdes',
    country: 'França',
    imageUrl: 'https://www.franceguide.info/wp-content/uploads/sites/18/lourdes-sanctuary-hd.jpg',
  },
  {
    name: 'La Salette',
    country: 'França',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/PaeteChurchjf6479_10.JPG',
  },
  {
    name: 'Paray le Monial',
    country: 'França',
    imageUrl: 'https://burgundy-tours.com/wp-content/uploads/2025/02/Tour-guide-in-Paray-le-Monial-56-scaled.webp',
  },
  {
    name: 'Nevers',
    country: 'França',
    imageUrl: 'https://cdnarautos.s3.amazonaws.com/sites/2/2021/04/Nevers-Franca-Sta.-Bernardete-corpo-incorrupto-santos-Antonio-Lutiane1-1024x547-1.jpg',
  },
  {
    name: 'Monte S. Michel',
    country: 'França',
    imageUrl:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200006620-77e5b77e5d/monte%20saint%20michel.webp?ph=7a8de8e761',
  },
  {
    name: 'Lisieux',
    country: 'França',
    imageUrl: 'https://www.franceguide.info/wp-content/uploads/sites/18/normandy-basilica-lisieux-hd.jpg',
  },
  {
    name: 'Paris',
    country: 'França',
    imageUrl: 'https://www.royalcaribbean.com/media-assets/pmc/content/dam/shore-x/paris-le-havre-leh/lh17-paris-sightseeing-without-lunch/stock-photo-skyline-of-paris-with-eiffel-tower-at-sunset-in-paris-france-eiffel-tower-is-one-of-the-most-752725282.jpg?w=1920',
  },
] as const;

export default function EarlyAccessDestinations({
  locale = 'pt',
}: {
  locale?: EarlyAccessLocale;
}) {
  const copy = getEarlyAccessCopy(locale);
  const d = copy.destinations;
  return (
    <section className="relative">
      {/* ── Cinematic journey intro ── */}
      <div className="relative overflow-hidden px-5 py-24 text-center sm:py-32">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(188,165,107,0.12) 0%, transparent 70%)',
          }}
        />

        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          {/* Animated gold line */}
          <motion.div
            className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#d4bc7d]/60 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
          />

          {/* Big stats — each appears with stagger */}
          <div className="mt-10 flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-12">
            {[
              { value: '14', label: d.statDays },
              { value: '3', label: d.statCountries },
              { value: '13', label: d.statShrines },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  delay: 0.3 + i * 0.15,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <p className="[font-family:var(--font-early-serif)] text-[3.2rem] font-medium leading-none text-[#f0cc70] sm:text-[4rem]">
                  {stat.value}
                </p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bottom gold line */}
          <motion.div
            className="mx-auto mt-10 h-px w-16 bg-gradient-to-r from-transparent via-[#d4bc7d]/60 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.8 }}
          />
        </motion.div>
      </div>

      {/* ── Destination cards ── */}
      <div className="flex flex-col gap-3 sm:gap-5">
        {DESTINATIONS.map((dest, i) => (
          <DestinationCard
            key={dest.name}
            name={dest.name}
            country={d.countries[dest.country] ?? dest.country}
            imageUrl={dest.imageUrl}
            highlight={'highlight' in dest && dest.highlight}
            priority={i < 2}
          />
        ))}
      </div>
    </section>
  );
}
