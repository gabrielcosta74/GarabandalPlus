"use client";

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

          <p className="rounded-lg bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
            Actividade calculada pelo último contacto de cada instalação. Estes dados permitem contar dispositivos e pessoas activas, mas não medem sessões, ecrãs visitados ou retenção por coorte. Actualizado em {new Date(data.generatedAt).toLocaleString('pt-PT')}.
          </p>
        </div>
      ) : null}
    </AdminLayout>
  );
}
