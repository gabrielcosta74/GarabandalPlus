"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

import { toMs, type Analysis, type ForecastPoint } from '../../../lib/ledger/analysis';
import styles from './financas.module.css';
import { euro, longDate, monthShort, smoothPath, useSize } from './ui';

const AXIS_WIDTH = 46;
const TOP = 34;
const BOTTOM = 28;

export type RiverRange = 'all' | 'year' | 'ahead';

/** Balance at any moment: the real figure up to today, the projection after it. */
export function balanceAt(ms: number, series: Analysis['series'], forecast: ForecastPoint[]): number | null {
  if (!series.length) return null;
  const todayMs = toMs(series[series.length - 1].date);
  if (ms <= todayMs) {
    const index = Math.round((ms - toMs(series[0].date)) / 86400000);
    return series[Math.max(0, Math.min(series.length - 1, index))].balance;
  }
  for (let i = 0; i < forecast.length - 1; i += 1) {
    const from = toMs(forecast[i].date);
    const to = toMs(forecast[i + 1].date);
    if (ms <= to) {
      const ratio = (ms - from) / (to - from);
      const eased = ratio * ratio * (3 - 2 * ratio);
      return forecast[i].balance + (forecast[i + 1].balance - forecast[i].balance) * eased;
    }
  }
  return forecast.length ? forecast[forecast.length - 1].balance : null;
}

function domainFor(range: RiverRange, series: Analysis['series'], forecast: ForecastPoint[], today: string): [number, number] {
  const start = series.length ? toMs(series[0].date) : toMs(today);
  const end = forecast.length ? toMs(forecast[forecast.length - 1].date) : toMs(today);
  const todayMs = toMs(today);
  if (range === 'year') return [start, todayMs + 6 * 86400000];
  if (range === 'ahead') return [todayMs - 30 * 86400000, end];
  return [start, end];
}

export default function BalanceRiver({
  series,
  forecast,
  bounds,
  trips,
  today,
  range,
  scrub,
  onScrub,
}: {
  series: Analysis['series'];
  forecast: ForecastPoint[];
  bounds: [number, number];
  trips: Analysis['trips'];
  today: string;
  range: RiverRange;
  scrub: number | null;
  onScrub: (ms: number | null) => void;
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const reduced = useReducedMotion();

  // The projection bends to its new shape instead of jumping.
  const [shown, setShown] = useState(forecast);
  const shownRef = useRef(forecast);
  useEffect(() => {
    if (shownRef.current.length !== forecast.length || reduced) {
      shownRef.current = forecast;
      setShown(forecast);
      return undefined;
    }
    const from = shownRef.current;
    const controls = animate(0, 1, {
      type: 'spring',
      stiffness: 130,
      damping: 22,
      onUpdate: ratio => {
        const next = forecast.map((point, i) => ({
          date: point.date,
          balance: from[i].balance + (point.balance - from[i].balance) * ratio,
          low: from[i].low + (point.low - from[i].low) * ratio,
          high: from[i].high + (point.high - from[i].high) * ratio,
        }));
        shownRef.current = next;
        setShown(next);
      },
    });
    return () => controls.stop();
  }, [forecast, reduced]);

  // The time window glides when the range changes.
  const target = useMemo(() => domainFor(range, series, forecast, today), [range, series, forecast, today]);
  const [domain, setDomain] = useState<[number, number]>(target);
  const domainRef = useRef(target);
  useEffect(() => {
    const from = domainRef.current;
    if (from[0] === target[0] && from[1] === target[1]) return undefined;
    if (reduced) {
      domainRef.current = target;
      setDomain(target);
      return undefined;
    }
    const controls = animate(0, 1, {
      type: 'spring',
      stiffness: 80,
      damping: 20,
      onUpdate: ratio => {
        const next: [number, number] = [from[0] + (target[0] - from[0]) * ratio, from[1] + (target[1] - from[1]) * ratio];
        domainRef.current = next;
        setDomain(next);
      },
    });
    return () => controls.stop();
  }, [target, reduced]);

  const plotWidth = Math.max(width - AXIS_WIDTH, 10);
  const x = (ms: number) => ((ms - domain[0]) / (domain[1] - domain[0])) * plotWidth;
  const y = (value: number) => TOP + (1 - (value - bounds[0]) / (bounds[1] - bounds[0])) * (height - TOP - BOTTOM);
  const todayMs = toMs(today);

  const paths = useMemo(() => {
    if (!width || !height || !series.length) return null;
    const visible = series.filter(point => {
      const ms = toMs(point.date);
      return ms >= domain[0] - 3 * 86400000 && ms <= domain[1] + 3 * 86400000;
    });
    const stride = Math.max(1, Math.ceil(visible.length / (plotWidth / 4)));
    const sampled = visible.filter((_, index) => index % stride === 0 || index === visible.length - 1);
    const past = smoothPath(sampled.map(point => [x(toMs(point.date)), y(point.balance)]), 0.12);
    const floor = height - BOTTOM;
    const lastPast = sampled[sampled.length - 1];
    const area = sampled.length
      ? `${past}L${x(toMs(lastPast.date)).toFixed(1)},${floor}L${x(toMs(sampled[0].date)).toFixed(1)},${floor}Z`
      : '';
    const line = smoothPath(shown.map(point => [x(toMs(point.date)), y(point.balance)]));
    const up = shown.map((point): [number, number] => [x(toMs(point.date)), y(point.high)]);
    const down = shown.map((point): [number, number] => [x(toMs(point.date)), y(point.low)]).reverse();
    const band = down.length
      ? `${smoothPath(up)}L${down[0][0].toFixed(1)},${down[0][1].toFixed(1)}${smoothPath(down).replace(/^M[^C]+/, '')}Z`
      : '';
    return { past, area, line, band };
    // x and y derive from the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, shown, domain, width, height, bounds]);

  const gridValues = useMemo(() => {
    const step = bounds[1] - bounds[0] > 500000 ? 200000 : 100000;
    const values: number[] = [];
    for (let value = Math.ceil(bounds[0] / step) * step; value < bounds[1]; value += step) values.push(value);
    return values;
  }, [bounds]);

  const monthTicks = useMemo(() => {
    const span = (domain[1] - domain[0]) / (30.4 * 86400000);
    const every = plotWidth < 500 ? (span > 12 ? 6 : 3) : span > 15 ? 3 : span > 7 ? 2 : 1;
    const ticks: { ms: number; label: string }[] = [];
    const cursor = new Date(domain[0]);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor.getTime() <= domain[1]) {
      const month = cursor.getUTCMonth();
      if (cursor.getTime() >= domain[0] && month % every === 0) {
        ticks.push({ ms: cursor.getTime(), label: month === 0 ? `${monthShort(0)} ${String(cursor.getUTCFullYear()).slice(2)}` : monthShort(month) });
      }
      cursor.setUTCMonth(month + 1);
    }
    return ticks;
  }, [domain, plotWidth]);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(plotWidth, event.clientX - rect.left));
    const ms = domain[0] + (px / plotWidth) * (domain[1] - domain[0]);
    const firstMs = series.length ? toMs(series[0].date) : ms;
    onScrub(Math.max(firstMs, Math.round(ms / 86400000) * 86400000));
  };

  const pointerMs = scrub ?? todayMs;
  const pointerValue = balanceAt(pointerMs, series, shown);
  const pointerX = x(pointerMs);
  const pointerY = pointerValue === null ? 0 : y(pointerValue);
  const delta = pointerValue === null || !series.length ? 0 : pointerValue - series[series.length - 1].balance;
  const tipOnLeft = pointerX > plotWidth * 0.68;

  return (
    <div
      ref={ref}
      className={styles.river}
      onPointerMove={handleMove}
      onPointerLeave={() => onScrub(null)}
      role="img"
      aria-label="Evolução do saldo até hoje e previsão até à última peregrinação. Passe o rato para ler cada dia."
    >
      {paths && (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="riverFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--in-bright)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--in-bright)" stopOpacity="0" />
            </linearGradient>
            <clipPath id="riverPlot"><rect x="0" y="0" width={plotWidth} height={height} /></clipPath>
            <clipPath id="riverReveal">
              <motion.rect x="0" y="0" height={height} initial={{ width: 0 }} animate={{ width }} transition={{ duration: 1.8, ease: [0.25, 1, 0.4, 1] }} />
            </clipPath>
          </defs>

          {gridValues.map(value => (
            <g key={value}>
              <line x1="0" x2={plotWidth} y1={y(value)} y2={y(value)} stroke="var(--line)" />
              <text x={width - AXIS_WIDTH + 12} y={y(value) + 4} fontSize="11.5" fill="var(--t3)">{value / 1000}k</text>
            </g>
          ))}
          {monthTicks.map(tick => (
            <text key={tick.ms} x={x(tick.ms)} y={height - 6} fontSize="11.5" fill="var(--t3)">{tick.label}</text>
          ))}

          <g clipPath="url(#riverPlot)">
            <g clipPath="url(#riverReveal)">
              <path d={paths.band} fill="rgba(245,245,242,0.07)" />
              <path d={paths.area} fill="url(#riverFill)" />
              <path d={paths.past} fill="none" stroke="var(--in-bright)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              <path d={paths.line} fill="none" stroke="var(--t1)" strokeWidth="2.25" strokeDasharray="0.5 7" strokeLinecap="round" />
              {trips.map(trip => {
                const px = x(toMs(trip.start));
                if (px < 0 || px > plotWidth) return null;
                const flip = px > plotWidth - 150;
                return (
                  <g key={trip.id}>
                    <line x1={px} x2={px} y1="14" y2={height - BOTTOM} stroke="var(--line2)" />
                    <text x={flip ? px - 8 : px + 8} y="24" textAnchor={flip ? 'end' : 'start'} fontSize="12" fill="var(--t2)">{trip.shortTitle}</text>
                  </g>
                );
              })}
            </g>
            {scrub === null && <line x1={x(todayMs)} x2={x(todayMs)} y1={TOP - 8} y2={height - BOTTOM} stroke="var(--t3)" strokeDasharray="2 4" />}
            {scrub !== null && <line x1={pointerX} x2={pointerX} y1={TOP - 8} y2={height - BOTTOM} stroke="rgba(255,255,255,0.45)" />}
            {pointerValue !== null && (
              <circle cx={pointerX} cy={pointerY} r="6" fill="var(--t1)" stroke="var(--bg)" strokeWidth="3" />
            )}
          </g>
        </svg>
      )}
      {scrub !== null && pointerValue !== null && (
        <div
          className={`${styles.glass} ${styles.riverTip}`}
          style={{ transform: `translate(${pointerX + (tipOnLeft ? -16 : 16)}px, ${Math.max(pointerY - 56, 4)}px) translateX(${tipOnLeft ? '-100%' : '0'})` }}
        >
          {longDate(new Date(pointerMs).toISOString())}
          <span>{delta >= 0 ? '+' : '−'}{euro(Math.abs(delta))} € face a hoje</span>
        </div>
      )}
    </div>
  );
}
