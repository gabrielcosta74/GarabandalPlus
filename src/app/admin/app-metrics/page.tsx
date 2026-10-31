"use client";

import type { ReactNode } from 'react';
import useSWR from 'swr';
import { Activity, BellRing, Smartphone, Users } from 'lucide-react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getBrowserAccessToken } from '../../../lib/supabase-browser';

type Metrics = {
  generatedAt: string;
  days: number;
  totals: {
    installations: number;
    activeDevices7d: number;
    activeDevices30d: number;
    activePeople7d: number;
    activePeople30d: number;
    installs7d: number;
    installs30d: number;
    pushEnabled: number;
    reachableDevices: number;
    englishDevices: number;
  };
  platforms: { platform: string; count: number }[];
  versions: { version: string; count: number }[];
  dailyInstalls: { day: string; installs: number }[];
  usage: Usage | null;
};

/** O que a própria app envia (app_events), já resumido pela base de dados. */
type Usage = {
  totals: { devices: number; accounts: number; sessions: number; minutesPerSession: number | null; screenViews: number };
  daily: { day: string; devices: number; sessions: number }[];
  areas: { area: string; views: number; devices: number }[];
  prayers: { feature: string; started: number; completed: number; medianSeconds: number | null }[];
  onboarding: { step: string; devices: number }[];
  paywall: { source: string; views: number; planTaps: number }[];
  purchases: { purchased: number; cancelled: number; failed: number; restored: number };
  shares: { channel: string; attempts: number; shared: number }[];
  links: { source: string; opens: number }[];
  notifications: { kind: string; opens: number }[];
  community: { action: string; total: number }[];
  retention: { cohort: string; devices: number; week1: number | null; week2: number | null; week4: number | null }[];
};

async function fetcher(url: string): Promise<Metrics> {
  const token = await getBrowserAccessToken();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as métricas.');
  return body;
}

const number = (value: number) => value.toLocaleString('pt-PT');
const platformName: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
  unknown: 'Desconhecida',
};

const areaName: Record<string, string> = {
  today: 'Hoje', pray: 'Rezar', community: 'Comunidade', explore: 'Explorar', profile: 'Perfil',
  prayer: 'Orações', novena: 'Novenas', onboarding: 'Onboarding', login: 'Entrar', welcome: 'Boas-vindas',
  digital: 'Rezar+', confession: 'Confissão', intentions: 'Pedidos de oração', 'share-gospel': 'Partilhar Evangelho',
  'share-saint': 'Partilhar santo', 'member-area': 'Área de membro', pilgrimage: 'Peregrinações',
};
const prayerName: Record<string, string> = {
  rosary: 'Terço', stations: 'Via-Sacra', adoration: 'Adoração', liturgy_hour: 'Liturgia das Horas',
  readings: 'Leituras do dia', angelus: 'Ângelus', immaculate: 'Ofício da Imaculada', prayer: 'Orações', novena: 'Novenas',
};
const onboardingName: Record<string, string> = {
  '/welcome': 'Boas-vindas', '/onboarding': 'Início', '/onboarding/language': 'Idioma', '/onboarding/apostolate': 'Apostolado',
  '/onboarding/pillar-prayer': 'Oração', '/onboarding/pillar-pilgrimage': 'Peregrinação', '/onboarding/pillar-community': 'Comunidade',
  '/onboarding/permissions/notifications': 'Pedido de notificações', '/onboarding/permissions/currency': 'Moeda',
  '/onboarding/choose-path': 'Entrar ou criar conta', '/login': 'Ecrã de entrada', '/onboarding/ready': 'Pronto',
  notifications_granted: 'Aceitou notificações', sign_up: 'Criou conta', onboarding_complete: 'Entrou na app',
};
const percent = (part: number, whole: number) => (whole ? `${Math.round(part / whole * 100)}%` : '—');
const duration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  return seconds < 90 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`;
};

function Panel({ title, detail, children, className = '' }: { title: string; detail?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BarList({ items, empty }: { items: { label: string; value: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 text-slate-500">{number(item.value)}{item.note ? ` · ${item.note}` : ''}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${item.value / max * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function UsageSection({ usage, days }: { usage: Usage; days: number }) {
  const t = usage.totals;
  const maxDaily = Math.max(1, ...usage.daily.map((item) => item.devices));
  const firstStep = usage.onboarding[0]?.devices ?? 0;
  return (
    <div className="space-y-6">
      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">Uso da app · {days} dias</h2>
        <p className="mt-1 text-xs text-slate-500">Enviado pela própria app em cada ecrã, oração, partilha e compra. Sem builds de desenvolvimento e sem nada do que as pessoas escrevem.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Smartphone} label="Aparelhos que abriram a app" value={t.devices} detail={`${number(t.accounts)} contas com sessão iniciada`} />
        <MetricCard icon={Activity} label="Sessões" value={t.sessions} detail={`${t.minutesPerSession ?? 0} min por sessão, em média`} />
        <MetricCard icon={Users} label="Ecrãs abertos" value={t.screenViews} detail={`${t.devices ? Math.round(t.screenViews / t.devices) : 0} por aparelho`} />
        <MetricCard icon={BellRing} label="Notificações abertas" value={usage.notifications.reduce((sum, item) => sum + item.opens, 0)} detail={`${number(usage.shares.reduce((sum, item) => sum + item.attempts, 0))} partilhas no mesmo período`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Aparelhos por dia" detail="Quantos aparelhos abriram a app em cada dia" className="xl:col-span-2">
          <div className="flex h-44 items-end gap-1" aria-label="Gráfico de aparelhos por dia">
            {usage.daily.map((item) => (
              <div key={item.day} className="group relative flex h-full flex-1 items-end" title={`${item.day}: ${item.devices} aparelhos, ${item.sessions} sessões`}>
                <div className="w-full rounded-t bg-slate-700/80 transition-colors group-hover:bg-slate-900" style={{ height: `${Math.max(4, item.devices / maxDaily * 100)}%` }} />
              </div>
            ))}
          </div>
          {usage.daily.length === 0 && <p className="mt-3 text-center text-sm text-slate-500">Ainda sem dados: chegam com a próxima versão da app.</p>}
        </Panel>
        <Panel title="Onde se passa o tempo" detail="Ecrãs abertos por área">
          <BarList empty="Sem ecrãs registados." items={usage.areas.map((item) => ({ label: areaName[item.area] || item.area, value: item.views, note: `${number(item.devices)} aparelhos` }))} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Orações" detail="Começadas, acabadas e o tempo que se leva a acabar">
          {usage.prayers.length === 0 ? <p className="text-sm text-slate-500">Sem orações registadas.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-semibold">Oração</th><th className="pb-2 text-right font-semibold">Começadas</th><th className="pb-2 text-right font-semibold">Acabadas</th><th className="pb-2 text-right font-semibold">Tempo</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {usage.prayers.map((item) => (
                  <tr key={item.feature}>
                    <td className="py-2 text-slate-700">{prayerName[item.feature] || item.feature}</td>
                    <td className="py-2 text-right text-slate-500">{number(item.started)}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{number(item.completed)} <span className="font-normal text-slate-500">({percent(item.completed, item.started)})</span></td>
                    <td className="py-2 text-right text-slate-500">{duration(item.medianSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Onboarding · 90 dias" detail="Aparelhos que chegam a cada passo, em relação ao primeiro">
          <BarList empty="Sem onboarding registado." items={usage.onboarding.map((item) => ({ label: onboardingName[item.step] || item.step, value: item.devices, note: percent(item.devices, firstStep) }))} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Rezar+" detail="Que funcionalidade bloqueada abre o ecrã de compra">
          <BarList empty="Ninguém abriu o Rezar+ neste período." items={usage.paywall.map((item) => ({ label: item.source === 'direct' ? 'Direto' : item.source, value: item.views, note: `${number(item.planTaps)} toques num plano` }))} />
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{number(usage.purchases.purchased)} compras · {number(usage.purchases.cancelled)} canceladas · {number(usage.purchases.failed)} falhadas · {number(usage.purchases.restored)} restauradas</p>
        </Panel>
        <Panel title="Partilhas" detail="Tentativas por tipo (partilhadas ou com resultado desconhecido no Android)">
          <BarList empty="Sem partilhas neste período." items={usage.shares.map((item) => ({ label: item.channel, value: item.attempts, note: `${number(item.shared)} enviadas` }))} />
        </Panel>
        <Panel title="Links que abriram a app" detail="Pelo ?src= da partilha ou pelo caminho do link">
          <BarList empty="Nenhum link abriu a app neste período." items={usage.links.map((item) => ({ label: item.source || 'outro', value: item.opens }))} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Notificações abertas" detail="Por tipo de notificação">
          <BarList empty="Sem notificações abertas." items={usage.notifications.map((item) => ({ label: item.kind, value: item.opens }))} />
        </Panel>
        <Panel title="Comunidade" detail="Gestos registados (sem o texto)">
          <BarList empty="Sem atividade na Comunidade." items={usage.community.map((item) => ({ label: item.action, value: item.total }))} />
        </Panel>
        <Panel title="Quem volta" detail="Aparelhos pela semana em que apareceram, e quantos voltaram">
          {usage.retention.length === 0 ? <p className="text-sm text-slate-500">Ainda sem semanas completas.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-semibold">Semana</th><th className="pb-2 text-right font-semibold">Aparelhos</th><th className="pb-2 text-right font-semibold">+1</th><th className="pb-2 text-right font-semibold">+2</th><th className="pb-2 text-right font-semibold">+4</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {usage.retention.map((item) => (
                  <tr key={item.cohort}>
                    <td className="py-2 text-slate-700">{new Date(item.cohort).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-2 text-right text-slate-500">{number(item.devices)}</td>
                    <td className="py-2 text-right">{item.week1 ?? 0}%</td>
                    <td className="py-2 text-right">{item.week2 ?? 0}%</td>
                    <td className="py-2 text-right">{item.week4 ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: {
  icon: typeof Smartphone;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{number(value)}</p>
        </div>
        <span className="rounded-lg bg-slate-100 p-2.5 text-slate-600"><Icon size={19} /></span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </section>
  );
}

export default function AppMetricsPage() {
  const { data, error, isLoading } = useSWR<Metrics>('/api/admin/app-metrics?days=30', fetcher, {
    revalidateOnFocus: false,
  });
  const metrics = data?.totals;
  const maxDaily = Math.max(1, ...(data?.dailyInstalls || []).map((item) => item.installs));
  const maxPlatform = Math.max(1, ...(data?.platforms || []).map((item) => item.count));

  return (
    <AdminLayout title="Métricas da app" description="Instalações e actividade recente dos dispositivos registados.">
      {isLoading && !data ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">A carregar métricas…</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error.message}</div>
      ) : data && metrics ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Smartphone} label="Instalações registadas" value={metrics.installations} detail={`${number(metrics.installs30d)} novas nos últimos 30 dias`} />
            <MetricCard icon={Users} label="Pessoas activas · 30 dias" value={metrics.activePeople30d} detail={`${number(metrics.activePeople7d)} pessoas nos últimos 7 dias`} />
            <MetricCard icon={Activity} label="Dispositivos activos · 7 dias" value={metrics.activeDevices7d} detail={`${number(metrics.activeDevices30d)} dispositivos nos últimos 30 dias`} />
            <MetricCard icon={BellRing} label="Push alcançável" value={metrics.reachableDevices} detail={`${number(metrics.pushEnabled)} dispositivos com push ligado`} />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
              <h2 className="text-base font-semibold text-slate-900">Novas instalações · 30 dias</h2>
              <p className="mt-1 text-xs text-slate-500">Registos de dispositivos por dia</p>
              <div className="mt-6 flex h-44 items-end gap-1" aria-label="Gráfico de novas instalações">
                {data.dailyInstalls.map((item) => (
                  <div key={item.day} className="group relative flex h-full flex-1 items-end" title={`${item.day}: ${item.installs}`}>
                    <div className="w-full rounded-t bg-amber-400/80 transition-colors group-hover:bg-amber-500" style={{ height: `${item.installs ? Math.max(4, item.installs / maxDaily * 100) : 0}%` }} />
                  </div>
                ))}
              </div>
              {metrics.installs30d === 0 && <p className="mt-3 text-center text-sm text-slate-500">Sem novas instalações neste período.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">Dispositivos por plataforma</h2>
              <div className="mt-5 space-y-4">
                {data.platforms.length === 0 ? <p className="text-sm text-slate-500">Sem dispositivos registados.</p> : data.platforms.map((item) => (
                  <div key={item.platform}>
                    <div className="mb-1 flex justify-between text-sm"><span>{platformName[item.platform] || item.platform}</span><span className="text-slate-500">{number(item.count)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${item.count / maxPlatform * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">{number(metrics.englishDevices)} dispositivos com idioma inglês · {number(metrics.installs7d)} novas instalações em 7 dias</p>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Versões instaladas</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.versions.map((item) => (
                <div key={item.version} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                  <span className="truncate text-slate-700">{item.version}</span><span className="ml-3 font-semibold text-slate-900">{number(item.count)}</span>
                </div>
              ))}
              {data.versions.length === 0 && <p className="text-sm text-slate-500">Sem versões registadas.</p>}
            </div>
          </section>

          {data.usage ? <UsageSection days={data.days} usage={data.usage} /> : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Não foi possível carregar o uso da app. As métricas dos dispositivos acima continuam certas.</p>
          )}

          <p className="rounded-lg bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
            Os dispositivos acima contam-se pelo último contacto de cada instalação; o uso da app vem dos eventos que a própria app envia. Actualizado em {new Date(data.generatedAt).toLocaleString('pt-PT')}.
          </p>
        </div>
      ) : null}
    </AdminLayout>
  );
}
