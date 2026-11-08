"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

import styles from './financas.module.css';

export const spring = { type: 'spring', stiffness: 170, damping: 26, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 90, damping: 20 } as const;

/** Same grouping as the bank statement and the Contabilidade: 311.157. */
export const NUMBER_LOCALE = 'de-DE';
export const euro = (value: number) => Math.round(value).toLocaleString(NUMBER_LOCALE);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthShort = (index: number) => MONTHS[index];
export const longDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS_LONG[month - 1]} de ${year}`;
};
export const shortMonth = (iso: string) => {
  const [year, month] = iso.slice(0, 7).split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
};

/**
 * Digits that roll like an odometer. Each digit takes its width from a hidden
 * "0" and is clipped only vertically, so a glyph can never be cut from the side.
 */
export function Rolling({ text, duration = 900, stagger = 40 }: { text: string; duration?: number; stagger?: number }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(true), 40);
    return () => window.clearTimeout(timer);
  }, []);
  const characters = [...text];
  return (
    <span className={styles.rolling} aria-label={text} role="text">
      {characters.map((character, index) => {
        const place = characters.length - index;
        if (!/\d/.test(character)) {
          return <span key={`s${place}`} className={styles.rollSep} aria-hidden>{character}</span>;
        }
        return (
          <span key={`d${place}`} className={styles.rollDigit} aria-hidden>
            <span className={styles.rollSizer}>0</span>
            <span
              className={styles.rollStack}
              style={{
                transform: `translateY(${armed ? -Number(character) * 10 : 0}%)`,
                transitionDuration: `${duration}ms`,
                transitionDelay: `${stagger ? place * stagger : 0}ms`,
              }}
            >
              {'0123456789'.split('').map(digit => <span key={digit}>{digit}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Rolling figure in whole euros. */
export function Euros({ value, suffix = ' €' }: { value: number; suffix?: string }) {
  return <><Rolling text={euro(value)} stagger={25} />{suffix}</>;
}

/** Catmull-Rom through the points, so charts bend instead of kinking. */
export function smoothPath(points: [number, number][], tension = 0.17): string {
  if (!points.length) return '';
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] || points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] || next;
    const c1x = current[0] + (next[0] - previous[0]) * tension;
    const c1y = current[1] + (next[1] - previous[1]) * tension;
    const c2x = next[0] - (after[0] - current[0]) * tension;
    const c2y = next[1] - (after[1] - current[1]) * tension;
    path += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${next[0].toFixed(1)},${next[1].toFixed(1)}`;
  }
  return path;
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ ...softSpring, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A glass surface whose highlight follows the pointer. */
export function Glass({ children, className = '' }: { children: ReactNode; className?: string }) {
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, []);
  return <div className={`${styles.glass} ${className}`} onPointerMove={onPointerMove}>{children}</div>;
}

type TipState = { x: number; y: number; text: ReactNode } | null;
const TipContext = createContext<{ show: (event: { clientX: number; clientY: number }, text: ReactNode) => void; hide: () => void }>({
  show: () => undefined,
  hide: () => undefined,
});
export const useTip = () => useContext(TipContext);

/** Rendered on <body>, since animated ancestors would otherwise offset a fixed element. */
export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = useMemo(() => ({
    show: (event: { clientX: number; clientY: number }, text: ReactNode) => setTip({ x: event.clientX, y: event.clientY, text }),
    hide: () => setTip(null),
  }), []);
  return (
    <TipContext.Provider value={value}>
      {children}
      {mounted && tip && createPortal(
        <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="status">{tip.text}</div>,
        document.body,
      )}
    </TipContext.Provider>
  );
}
