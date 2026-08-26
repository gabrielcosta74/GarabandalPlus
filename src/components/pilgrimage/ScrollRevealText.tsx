'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

type ScrollRevealTextProps = {
  text: string;
  className?: string;
};

/**
 * Award-winning scroll-linked reveal: each word fades + rises into place as the
 * element travels through the viewport. The whole phrase is "written" bit by bit
 * as the user scrolls, instead of appearing all at once.
 */
export default function ScrollRevealText({ text, className }: ScrollRevealTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    // Start revealing when the phrase enters the lower third, finish before it
    // reaches the middle — so the effect completes while it's still prominent.
    offset: ['start 0.9', 'start 0.35'],
  });

  const words = text.split(' ');

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return (
          <Word key={`${word}-${i}`} progress={scrollYProgress} range={[start, end]}>
            {word}
          </Word>
        );
      })}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const y = useTransform(progress, range, [14, 0]);
  const blur = useTransform(progress, range, [6, 0]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <span className="inline-block whitespace-pre">
      <motion.span className="inline-block" style={{ opacity, y, filter }}>
        {children}
      </motion.span>
      {' '}
    </span>
  );
}
