"use client";

import { useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';

import { projectBalance, toMs, type Analysis } from '../../../lib/ledger/analysis';
import BalanceRiver, { balanceAt, type RiverRange } from './BalanceRiver';
import { DayMatrix, MonthlyRibbon, MoneyFlow } from './FlowCharts';
import { BalanceCapsule, PaceRing, ReceivableTubes } from './LiquidPanels';
import styles from './financas.module.css';
import { Euros, Glass, Reveal, Rolling, TipProvider, euro, longDate, shortMonth, spring } from './ui';

const COST_KEY = 'financas:custo-viagens';

function syncLabel(syncedAt: string | null, today: string) {
  if (!syncedAt) return 'Montepio · sem leitura';
  const date = new Date(syncedAt);
  const time = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return date.toISOString().slice(0, 10) === today
    ? `Montepio · hoje às ${time}`
    : `Montepio · ${date.toLocaleDateString('pt-PT')} às ${time}`;
}

export default function FinanceDashboard({ data, demo = false }: { data: Analysis; demo?: boolean }) {
  const [cost, setCost] = useState(70);
  const [range, setRange] = useState<RiverRange>('all');
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(COST_KEY));
      if (saved >= 40 && saved <= 95) setCost(saved);
    } catch {
      // Without storage the assumption simply resets to its default.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(COST_KEY, String(cost));
    } catch {
      // See above.
    }
  }, [cost]);

  const forecast = useMemo(() => (data.forecast ? projectBalance(data.forecast, cost) : []), [data.forecast, cost]);

  // Fixed for the whole slider range, so dragging moves the line and not the scale.
  const bounds = useMemo<[number, number]>(() => {
    const scenarios = data.forecast ? [...projectBalance(data.forecast, 40), ...projectBalance(data.forecast, 95)] : [];
    const values = [...data.series.map(point => point.balance), ...scenarios.flatMap(point => [point.low, point.high])];
    if (!values.length) return [0, 100000];
    const low = Math.min(...values);
    const high = Math.max(...values);
    const pad = Math.max((high - low) * 0.1, 1000);
    return [Math.max(0, Math.floor((low - pad) / 10000) * 10000), Math.ceil((high + pad) / 10000) * 10000];
  }, [data.forecast, data.series]);

  const shownValue = scrub === null ? data.balance : balanceAt(scrub, data.series, forecast);
  const heroValue = shownValue ?? 0;
  const whole = Math.floor(heroValue);
  const cents = Math.round((heroValue - whole) * 100) % 100;
  const isFuture = scrub !== null && scrub > toMs(data.today);

  const ahead = forecast.slice(1);
  const peak = ahead.reduce<typeof ahead[number] | null>((best, point) => (!best || point.balance > best.balance ? point : best), null);
  const last = ahead[ahead.length - 1] || null;

  const heroLine = () => {
    if (scrub !== null) return longDate(new Date(scrub).toISOString());
    if (data.sinceDelta === null || !data.sinceDate) return '';
    const since = data.sinceDate.endsWith('-01-01') ? '1 de janeiro' : longDate(data.sinceDate).replace(/ de \d{4}$/, '');
    return <><em>{data.sinceDelta >= 0 ? '+' : '−'}{euro(Math.abs(data.sinceDelta))} €</em> desde {since}</>;
  };

  return (
    <MotionConfig reducedMotion="user">
      <TipProvider>
        <div className={styles.page}>
          <div className={`${styles.ambient} ${styles.ambientMint}`} />
          <div className={`${styles.ambient} ${styles.ambientViolet}`} />
          <div className={`${styles.ambient} ${styles.ambientCoral}`} />
          <div className={`${styles.ambient} ${styles.ambientDeep}`} />

          <div className={styles.inner}>
            <header className={styles.top}>
              <h1 className={styles.title} style={{ margin: 0 }}>Análise</h1>
              <div className={`${styles.glass} ${styles.status}`}>
                <i />
                {demo ? <span className={styles.demo}>Dados de exemplo</span> : syncLabel(data.syncedAt, data.today)}
              </div>
            </header>

            <section className={styles.hero}>
              <div className={styles.label}>{isFuture ? 'Saldo previsto' : scrub !== null ? 'Saldo' : 'Saldo hoje'}</div>
              <div className={styles.heroNumber}>
                <Rolling text={euro(whole)} duration={scrub === null ? 1100 : 240} stagger={scrub === null ? 55 : 0} />
                <span className={styles.heroCents}>
                  ,<Rolling text={String(cents).padStart(2, '0')} duration={scrub === null ? 1100 : 240} stagger={0} /> €
                </span>
              </div>
              <div className={styles.heroLine}>{heroLine()}</div>

              <div className={styles.riverWrap}>
                <BalanceRiver
                  series={data.series}
                  forecast={forecast}
                  bounds={bounds}
                  trips={data.trips}
                  today={data.today}
                  range={range}
                  scrub={scrub}
                  onScrub={setScrub}
                />
                <Glass className={styles.dock}>
                  <div className={styles.seg} role="group" aria-label="Período do gráfico">
                    {([['all', 'Tudo'], ['year', 'Até hoje'], ['ahead', 'Previsão']] as [RiverRange, string][]).map(([key, label]) => (
                      <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>
                        {range === key && <motion.span layoutId="river-range" className={styles.segThumb} transition={spring} />}
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className={styles.cost}>
                    Custo das viagens
                    <input
                      className={styles.slider}
                      type="range"
                      min={40}
                      max={95}
                      step={1}
                      value={cost}
                      style={{ '--p': `${((cost - 40) / 55) * 100}%` } as React.CSSProperties}
                      onChange={event => setCost(Number(event.target.value))}
                      aria-valuetext={`${cost} por cento da receita de cada peregrinação`}
                    />
                    <output>{cost}%</output>
                  </label>
                </Glass>
              </div>
            </section>

            <Reveal className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.label}>Livre</span>
                <b>{data.free === null ? '—' : <Euros value={data.free} />}</b>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Por receber</span>
                <b><Euros value={data.receivable} /></b>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Pico previsto</span>
                <b>{peak ? <Euros value={peak.balance} /> : '—'}</b>
                {peak && <small>{shortMonth(peak.date)}</small>}
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Fim da previsão</span>
                <b>{last ? <Euros value={last.balance} /> : '—'}</b>
                {last && <small>{shortMonth(last.date)}</small>}
              </div>
            </Reveal>

            {data.free !== null && (
              <section className={`${styles.section} ${styles.twoUp}`}>
                <Reveal><BalanceCapsule trips={data.trips} free={data.free} /></Reveal>
                <Reveal delay={0.08}><ReceivableTubes trips={data.trips} receivable={data.receivable} /></Reveal>
              </section>
            )}

            <section className={styles.section}>
              <Reveal>
                <Glass className={styles.panel}>
                  <div className={styles.label}>Por onde passou o dinheiro, nos últimos {data.flow.windowDays} dias</div>
                  <MoneyFlow flow={data.flow} />
                </Glass>
              </Reveal>
            </section>

            <section className={`${styles.section} ${styles.ribbonUp}`}>
              <Reveal>
                <Glass className={styles.panel}>
                  <div className={styles.label}>Entradas e saídas por mês</div>
                  <MonthlyRibbon months={data.months} />
                </Glass>
              </Reveal>
              <Reveal delay={0.08} className={styles.pace}><PaceRing pace={data.pace} /></Reveal>
            </section>

            <section className={styles.section}>
              <Reveal>
                <div className={styles.label}>Cada dia</div>
                <DayMatrix days={data.days} />
                <div className={styles.matrixFoot}>
                  <span><i style={{ background: 'var(--in-bright)' }} />Entrou mais</span>
                  <span><i style={{ background: 'var(--out)' }} />Saiu mais</span>
                </div>
              </Reveal>
            </section>

            <section className={`${styles.section} ${styles.reads}`}>
              <Reveal className={styles.read}>
                <b>{data.pilgrimageShare === null ? '—' : `${Math.round(data.pilgrimageShare * 100)}%`}</b>
                <span>das entradas vêm de peregrinações</span>
              </Reveal>
              <Reveal delay={0.08} className={styles.read}>
                <b>{data.runwayMonths === null ? '—' : `${data.runwayMonths} meses`}</b>
                <span>de custos fixos cobertos pelo saldo livre</span>
              </Reveal>
            </section>

            <p className={styles.foot}>
              A previsão soma prestações em falta, doações e quotas, e subtrai custos fixos e custos das viagens.
              O custo das viagens é um pressuposto: as saídas ainda não estão ligadas a cada peregrinação.
            </p>
          </div>
        </div>
      </TipProvider>
    </MotionConfig>
  );
}
