"use client";

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

import type { Analysis } from '../../../lib/ledger/analysis';
import styles from './financas.module.css';
import { Euros, Glass, euro, spring, useTip } from './ui';

const ADVANCE_TONES = ['var(--hold)', 'var(--hold2)', 'var(--hold3)'];

/** The balance as one glass capsule: money already spoken for, and what is free. */
export function BalanceCapsule({ trips, free }: { trips: Analysis['trips']; free: number }) {
  const tip = useTip();
  const [active, setActive] = useState<string | null>(null);
  const capsuleRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(capsuleRef, { once: true, amount: 0.3 });
  const parts = [
    ...trips.filter(trip => trip.advance > 0).map((trip, index) => ({
      key: trip.id,
      label: trip.shortTitle,
      amount: trip.advance,
      tone: ADVANCE_TONES[Math.min(index, ADVANCE_TONES.length - 1)],
    })),
    { key: 'free', label: 'Livre', amount: Math.max(free, 0), tone: 'var(--in)' },
  ];
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  const focused = parts.find(part => part.key === active);
  const hover = (key: string | null) => {
    setActive(key);
    if (key === null) tip.hide();
  };

  return (
    <Glass className={styles.panel}>
      <div className={styles.label}>{focused && focused.key !== 'free' ? `Adiantado · ${focused.label}` : 'Livre, sem adiantamentos'}</div>
      <div className={styles.bigNumber}><Euros value={focused ? focused.amount : free} suffix="" /><span className={styles.unit}>€</span></div>
      <div ref={capsuleRef} className={styles.capsule} onPointerLeave={() => hover(null)} role="img" aria-label={parts.map(part => `${part.label}: ${euro(part.amount)} euros`).join('; ')}>
        {parts.map((part, index) => (
          <motion.div
            key={part.key}
            className={styles.liquid}
            style={{ background: part.tone, opacity: active && active !== part.key ? 0.45 : 1 }}
            initial={{ flexGrow: 0.0001, flexBasis: 0 }}
            animate={{ flexGrow: inView ? (part.amount / total) * (active === part.key ? 1.16 : 1) : 0.0001 }}
            transition={{ ...spring, delay: active ? 0 : index * 0.06 }}
            onPointerEnter={() => hover(part.key)}
          />
        ))}
      </div>
      <div className={styles.legend}>
        {parts.map(part => (
          <button key={part.key} type="button" onPointerEnter={() => hover(part.key)} onPointerLeave={() => hover(null)}>
            <i style={{ background: part.tone }} />{part.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>Só desconta pagamentos a fornecedores registados em Logística.</p>
    </Glass>
  );
}

function Waves() {
  const path = 'M0,12 V6 C25,0 50,0 75,6 S125,12 150,6 S200,0 225,6 S275,12 300,6 V12 Z';
  return (
    <>
      <svg className={`${styles.wave} ${styles.waveBack}`} viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden><path d={path} fill="var(--in-bright)" /></svg>
      <svg className={styles.wave} viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden><path d={path} fill="var(--in-bright)" /></svg>
    </>
  );
}

/** What is still due, as tubes that fill while pilgrims pay. */
export function ReceivableTubes({ trips, receivable }: { trips: Analysis['trips']; receivable: number }) {
  const [active, setActive] = useState<string | null>(null);
  const focused = trips.find(trip => trip.id === active);
  return (
    <Glass className={styles.panel}>
      <div className={styles.label}>{focused ? `Por receber · ${focused.shortTitle}` : 'Por receber'}</div>
      <div className={styles.bigNumber}><Euros value={focused ? focused.remaining : receivable} suffix="" /><span className={styles.unit}>€</span></div>
      <div className={styles.tubes}>
        {trips.map((trip, index) => {
          const share = trip.totalDue > 0 ? Math.min(trip.paid / trip.totalDue, 1) : 0;
          return (
            <div
              key={trip.id}
              className={styles.tubeCol}
              onPointerEnter={() => setActive(trip.id)}
              onPointerLeave={() => setActive(null)}
            >
              <div className={styles.tube} role="img" aria-label={`${trip.shortTitle}: ${Math.round(share * 100)} por cento pago`}>
                <motion.div
                  className={styles.fill}
                  initial={{ height: '0%' }}
                  whileInView={{ height: `${share * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 42, damping: 13, delay: 0.15 + index * 0.14 }}
                >
                  <Waves />
                </motion.div>
                <div className={styles.tubePct}>{Math.round(share * 100)}%</div>
              </div>
              <div className={styles.tubeName}>{trip.shortTitle}</div>
              <div className={styles.tubeMeta}>{trip.daysToStart} dias</div>
            </div>
          );
        })}
      </div>
    </Glass>
  );
}

/** This month's income against a typical month, with a mark for where it should be today. */
export function PaceRing({ pace }: { pace: Analysis['pace'] }) {
  const radius = 92;
  const length = Math.PI * radius;
  const share = pace.share === null ? 0 : Math.min(pace.share, 1);
  const angle = Math.PI * (1 - pace.elapsed);
  const mark = (distance: number) => [110 + Math.cos(angle) * distance, 112 - Math.sin(angle) * distance];
  const [x1, y1] = mark(radius + 12);
  const [x2, y2] = mark(radius - 12);
  const difference = pace.share === null ? 0 : pace.share - pace.elapsed;
  const verdict = pace.share === null
    ? 'sem mês de referência'
    : Math.abs(difference) <= 0.03 ? 'no ritmo' : difference > 0 ? 'à frente do ritmo' : 'abaixo do ritmo';
  return (
    <Glass className={`${styles.panel} ${styles.pace}`}>
      <div className={styles.label}>Este mês</div>
      <div className={styles.ring}>
        <svg viewBox="0 0 220 124" role="img" aria-label={`Entradas deste mês a ${Math.round((pace.share || 0) * 100)} por cento de um mês típico, ${verdict}.`}>
          <defs>
            <linearGradient id="ringFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--in)" />
              <stop offset="1" stopColor="var(--in-bright)" />
            </linearGradient>
          </defs>
          <path d="M18,112 A92,92 0 0 1 202,112" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
          <motion.path
            d="M18,112 A92,92 0 0 1 202,112"
            fill="none"
            stroke="url(#ringFill)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={length}
            initial={{ strokeDashoffset: length }}
            whileInView={{ strokeDashoffset: length * (1 - share) }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 38, damping: 14, delay: 0.2 }}
          />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--t1)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className={styles.ringMid}>
          <b>{pace.share === null ? '—' : `${Math.round(pace.share * 100)}%`}</b>
          <small>{verdict}</small>
        </div>
      </div>
      <div className={styles.pair}>
        <div>Entradas<b>{euro(pace.inflow)} €</b></div>
        <div style={{ textAlign: 'right' }}>Saídas<b>{euro(pace.outflow)} €</b></div>
      </div>
    </Glass>
  );
}
