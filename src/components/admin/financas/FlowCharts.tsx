"use client";

import { useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

import type { Analysis, FlowItem } from '../../../lib/ledger/analysis';
import styles from './financas.module.css';
import { euro, longDate, monthShort, smoothPath, useSize, useTip } from './ui';

const FLOW_HEIGHT = 430;
const toneColor = (tone: FlowItem['tone']) => tone === 'in' ? 'var(--in-bright)' : tone === 'out' ? 'var(--out)' : 'var(--t3)';

/** Stacks items so every label has room, however small its value. */
function stack(items: FlowItem[], height: number, gap: number, minRow: number) {
  const total = items.reduce((sum, item) => sum + item.amount, 0) || 1;
  let scale = (height - gap * (items.length - 1)) / total;
  for (let i = 0; i < 12; i += 1) {
    const used = items.reduce((sum, item) => sum + Math.max(item.amount * scale, minRow), 0) + gap * (items.length - 1);
    if (used <= height) break;
    scale *= height / used;
  }
  let y = 0;
  return items.map(item => {
    const h = Math.max(item.amount * scale, 2.5);
    const row = { item, y, h };
    y += Math.max(h, minRow) + gap;
    return row;
  });
}

function FlowList({ flow }: { flow: Analysis['flow'] }) {
  const max = Math.max(...flow.sources.map(item => item.amount), ...flow.destinations.map(item => item.amount), 1);
  const list = (items: FlowItem[]) => items.map(item => (
    <div key={item.key} className={styles.flowRow}>
      <span>{item.label}</span><b>{euro(item.amount)} €</b>
      <div className={styles.flowBar} style={{ background: toneColor(item.tone), width: `${Math.max((item.amount / max) * 100, 1)}%` }} />
    </div>
  ));
  return (
    <>
      <div className={styles.flowHead}>Entrou</div>
      <div className={styles.flowList}>{list(flow.sources)}</div>
      <div className={styles.flowHead}>Saiu ou ficou</div>
      <div className={styles.flowList}>{list(flow.destinations)}</div>
    </>
  );
}

export function MoneyFlow({ flow }: { flow: Analysis['flow'] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const height = FLOW_HEIGHT;
  const [hovered, setHovered] = useState<string | null>(null);
  const tip = useTip();

  const layout = useMemo(() => {
    if (!width || width < 640) return null;
    const left = stack(flow.sources, height, 12, 26);
    const right = stack(flow.destinations, height, 12, 26);
    const lx = 170;
    const rx = width - 210;
    const cx = (lx + rx) / 2;
    const capsuleWidth = 14;
    const scaleOf = (rows: { item: FlowItem; h: number }[]) => Math.min(...rows.map(row => row.h / (row.item.amount || 1)));
    const k = Math.min(scaleOf(left), scaleOf(right)) * 0.8;
    const capsuleHeight = flow.total * k;
    const capsuleTop = (height - capsuleHeight) / 2;
    return { left, right, lx, rx, cx, k, capsuleWidth, capsuleHeight, capsuleTop };
  }, [flow, width, height]);

  const narrow = width > 0 && width < 640;
  const dim = (key: string) => (hovered && hovered !== key ? 0.22 : 1);
  const bind = (key: string, label: string, amount: number) => ({
    onPointerMove: (event: React.PointerEvent) => {
      setHovered(key);
      tip.show(event, <>{label} · {euro(amount)} €</>);
    },
    onPointerLeave: () => {
      setHovered(null);
      tip.hide();
    },
  });

  const ribbons = () => {
    if (!layout) return null;
    const { left, right, lx, rx, cx, k, capsuleWidth, capsuleTop } = layout;
    const elements: React.ReactNode[] = [];
    let cursor = capsuleTop;
    left.forEach(({ item, y, h }) => {
      const t = Math.max(item.amount * k, 0.8);
      const mid = (lx + cx) / 2;
      const key = `in-${item.key}`;
      const color = toneColor(item.tone);
      const xEnd = cx - capsuleWidth / 2;
      elements.push(
        <g key={key}>
          <path
            className={styles.rib}
            d={`M${lx},${y}C${mid},${y} ${mid},${cursor} ${xEnd},${cursor}L${xEnd},${cursor + t}C${mid},${cursor + t} ${mid},${y + h} ${lx},${y + h}Z`}
            fill={`url(#flow-${item.tone}-in)`}
            style={{ opacity: dim(key) }}
            {...bind(key, item.label, item.amount)}
          />
          {item.amount / flow.total > 0.04 && (
            <path className={styles.particle} d={`M${lx},${y + h / 2}C${mid},${y + h / 2} ${mid},${cursor + t / 2} ${xEnd},${cursor + t / 2}`} fill="none" stroke={color} strokeWidth="2" strokeDasharray="1.5 48.5" strokeLinecap="round" />
          )}
          <rect x={lx - 3} y={y} width="3" height={h} rx="1.5" fill={color} />
          {h > 30 ? (
            <>
              <text x={lx - 14} y={y + h / 2 - 3} textAnchor="end" fontSize="14" fill="var(--t1)">{item.label}</text>
              <text x={lx - 14} y={y + h / 2 + 15} textAnchor="end" fontSize="12.5" fill="var(--t3)">{euro(item.amount)} €</text>
            </>
          ) : (
            <text x={lx - 14} y={y + h / 2 + 4} textAnchor="end" fontSize="12.5" fill="var(--t2)">{item.label} · {euro(item.amount)} €</text>
          )}
        </g>,
      );
      cursor += t;
    });
    cursor = capsuleTop;
    right.forEach(({ item, y, h }) => {
      const t = Math.max(item.amount * k, 0.8);
      const mid = (cx + rx) / 2;
      const key = `out-${item.key}`;
      const color = toneColor(item.tone);
      const xStart = cx + capsuleWidth / 2;
      elements.push(
        <g key={key}>
          <path
            className={styles.rib}
            d={`M${xStart},${cursor}C${mid},${cursor} ${mid},${y} ${rx},${y}L${rx},${y + h}C${mid},${y + h} ${mid},${cursor + t} ${xStart},${cursor + t}Z`}
            fill={`url(#flow-${item.tone}-out)`}
            style={{ opacity: dim(key) }}
            {...bind(key, item.label, item.amount)}
          />
          {item.amount / flow.total > 0.04 && (
            <path className={styles.particle} d={`M${xStart},${cursor + t / 2}C${mid},${cursor + t / 2} ${mid},${y + h / 2} ${rx},${y + h / 2}`} fill="none" stroke={color} strokeWidth="2" strokeDasharray="1.5 48.5" strokeLinecap="round" />
          )}
          <rect x={rx} y={y} width="3" height={h} rx="1.5" fill={color} />
          {h > 30 ? (
            <>
              <text x={rx + 14} y={y + h / 2 - 3} fontSize="14" fill="var(--t1)">{item.label}</text>
              <text x={rx + 14} y={y + h / 2 + 15} fontSize="12.5" fill="var(--t3)">{euro(item.amount)} €</text>
            </>
          ) : (
            <text x={rx + 14} y={y + h / 2 + 4} fontSize="12.5" fill="var(--t2)">{item.label} · {euro(item.amount)} €</text>
          )}
        </g>,
      );
      cursor += t;
    });
    return elements;
  };

  return (
    <div ref={ref}>
      {narrow ? <FlowList flow={flow} /> : (
        <div className={styles.flow}>
          {layout && (
            <motion.svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Entradas e destinos do dinheiro nos últimos ${flow.windowDays} dias, num total de ${euro(flow.total)} euros.`}
              initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
              animate={inView ? { opacity: 1, clipPath: 'inset(0 0% 0 0%)' } : undefined}
              transition={{ duration: 1.4, ease: [0.25, 1, 0.4, 1] }}
            >
              <defs>
                {(['in', 'out', 'neutral'] as const).map(tone => (
                  <g key={tone}>
                    <linearGradient id={`flow-${tone}-in`} x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0" stopColor={toneColor(tone)} stopOpacity="0.42" />
                      <stop offset="1" stopColor={toneColor(tone)} stopOpacity="0.14" />
                    </linearGradient>
                    <linearGradient id={`flow-${tone}-out`} x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0" stopColor={toneColor(tone)} stopOpacity="0.14" />
                      <stop offset="1" stopColor={toneColor(tone)} stopOpacity="0.42" />
                    </linearGradient>
                  </g>
                ))}
              </defs>
              {ribbons()}
              <rect
                x={layout.cx - layout.capsuleWidth / 2}
                y={layout.capsuleTop}
                width={layout.capsuleWidth}
                height={layout.capsuleHeight}
                rx={layout.capsuleWidth / 2}
                fill="rgba(245,245,242,0.92)"
              />
            </motion.svg>
          )}
        </div>
      )}
    </div>
  );
}

export function MonthlyRibbon({ months }: { months: Analysis['months'] }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [hovered, setHovered] = useState<number | null>(null);
  const tip = useTip();
  const rows = months.filter(row => row.complete);
  const max = Math.max(...rows.map(row => Math.max(row.inflow, row.outflow)), 1);
  const mid = (height - 22) / 2;
  const x = (i: number) => (rows.length < 2 ? width / 2 : 6 + (i / (rows.length - 1)) * (width - 12));
  const scale = (value: number) => (value / max) * (mid - 12);
  const top = rows.map((row, i): [number, number] => [x(i), mid - 3 - scale(row.inflow)]);
  const bottom = rows.map((row, i): [number, number] => [x(i), mid + 3 + scale(row.outflow)]);
  const area = (points: [number, number][], base: number) =>
    points.length ? `${smoothPath(points)}L${points[points.length - 1][0]},${base}L${points[0][0]},${base}Z` : '';
  const label = (month: string) => monthShort(Number(month.slice(5, 7)) - 1);

  return (
    <div ref={ref} className={styles.ribbon}>
      {width > 0 && height > 0 && rows.length > 0 && (
        <motion.svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Entradas por cima e saídas por baixo, mês a mês."
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={inView ? { clipPath: 'inset(0 0% 0 0)' } : undefined}
          transition={{ duration: 1.5, ease: [0.25, 1, 0.4, 1] }}
        >
          <defs>
            <linearGradient id="ribbonIn" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--in-bright)" />
              <stop offset="1" stopColor="var(--in)" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="ribbonOut" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--out)" stopOpacity="0.5" />
              <stop offset="1" stopColor="var(--out)" />
            </linearGradient>
          </defs>
          <path d={area(top, mid - 3)} fill="url(#ribbonIn)" />
          <path d={area(bottom, mid + 3)} fill="url(#ribbonOut)" />
          {hovered !== null && (
            <>
              <line x1={x(hovered)} x2={x(hovered)} y1="4" y2={height - 24} stroke="rgba(255,255,255,0.5)" />
              <circle cx={x(hovered)} cy={top[hovered][1]} r="5" fill="var(--t1)" stroke="var(--bg)" strokeWidth="2" />
              <circle cx={x(hovered)} cy={bottom[hovered][1]} r="5" fill="var(--t1)" stroke="var(--bg)" strokeWidth="2" />
            </>
          )}
          {rows.map((row, i) => (
            <text key={row.month} x={x(i)} y={height - 3} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fontSize="11.5" fill="var(--t3)">{label(row.month)}</text>
          ))}
          {rows.map((row, i) => {
            const band = width / rows.length;
            return (
              <rect
                key={row.month}
                x={x(i) - band / 2}
                y="0"
                width={band}
                height={height}
                fill="transparent"
                onPointerMove={event => {
                  setHovered(i);
                  tip.show(event, <>{label(row.month)} · +{euro(row.inflow)} € · −{euro(row.outflow)} €</>);
                }}
                onPointerLeave={() => {
                  setHovered(null);
                  tip.hide();
                }}
              />
            );
          })}
        </motion.svg>
      )}
    </div>
  );
}

/** One dot per day: the size says how much moved, the colour which way. */
export function DayMatrix({ days }: { days: Analysis['days'] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const inViewRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(inViewRef, { once: true, amount: 0.2 });
  const tip = useTip();

  const grid = useMemo(() => {
    if (!width || !days.length) return null;
    const fits = Math.floor(width / 13);
    const totalWeeks = Math.ceil((days.length + 6) / 7);
    const weeks = Math.min(totalWeeks, fits);
    const visible = days.slice(-Math.min(days.length, weeks * 7 - 6));
    const firstWeekday = (new Date(`${visible[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const columns = Math.ceil((visible.length + firstWeekday) / 7);
    const cell = width / columns;
    const peak = Math.max(...visible.map(day => Math.abs(day.net)), 1);
    const labels: { x: number; text: string }[] = [];
    const dots = visible.map((day, index) => {
      const position = index + firstWeekday;
      const column = Math.floor(position / 7);
      if (day.date.endsWith('-01') || index === 0) {
        const lastLabel = labels[labels.length - 1];
        if (!lastLabel || column * cell - lastLabel.x > 26) {
          labels.push({ x: column * cell, text: monthShort(Number(day.date.slice(5, 7)) - 1) });
        }
      }
      return { ...day, cx: column * cell + cell / 2, cy: 22 + (position % 7) * cell + cell / 2, index };
    });
    return { dots, cell, peak, labels, height: 22 + 7 * cell };
  }, [days, width]);

  return (
    <div ref={node => { ref.current = node; inViewRef.current = node; }} className={styles.matrix}>
      {grid && (
        <svg viewBox={`0 0 ${width} ${grid.height}`} role="img" aria-label="Resultado de cada dia: pontos verdes quando entrou mais, coral quando saiu mais, maiores quanto maior o valor.">
          {grid.labels.map(label => <text key={label.x} x={label.x + 2} y="11" fontSize="11.5" fill="var(--t3)">{label.text}</text>)}
          {inView && grid.dots.map(dot => {
            const magnitude = Math.sqrt(Math.abs(dot.net) / grid.peak);
            const radius = dot.net === 0 ? 1.3 : 2 + (grid.cell / 2 - 2.8) * magnitude;
            return (
              <circle
                key={dot.date}
                className={styles.dot}
                cx={dot.cx}
                cy={dot.cy}
                r={radius}
                fill={dot.net === 0 ? 'rgba(255,255,255,0.12)' : dot.net > 0 ? 'var(--in-bright)' : 'var(--out)'}
                style={{ animationDelay: `${dot.index * 2.4}ms` }}
              />
            );
          })}
          {inView && grid.dots.map(dot => (
            <rect
              key={`hit-${dot.date}`}
              x={dot.cx - grid.cell / 2}
              y={dot.cy - grid.cell / 2}
              width={grid.cell}
              height={grid.cell}
              fill="transparent"
              onPointerMove={event => tip.show(event, <>{longDate(dot.date)} · {dot.net >= 0 ? '+' : '−'}{euro(Math.abs(dot.net))} €</>)}
              onPointerLeave={tip.hide}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
