"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { Activity, Users, FolderLock } from 'lucide-react';

/** Authenticated fetcher: attaches the admin Bearer token (same pattern as dashboard). */
export const activityFetcher = async (url: string) => {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error('No session');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const TABS = [
  { href: '/admin/membros/atividade', label: 'Visão Geral', icon: Activity },
  { href: '/admin/membros/atividade/membros', label: 'Por Membro', icon: Users },
  { href: '/admin/membros/atividade/conteudos', label: 'Por Conteúdo', icon: FolderLock },
];

export function ActivityTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2 mb-8 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              active
                ? 'border-garabandal-gold text-garabandal-dark'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// Human-readable labels for feature keys.
export const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Início',
  novenas: 'Novenas',
  cursos: 'Cursos',
  academy: 'Academia',
  documentos: 'Documentação',
  velas: 'Velas / Intenções',
  prayers: 'Orações',
  live: 'Em Direto',
  quota: 'Quota',
  profile: 'Perfil',
  espiritualidade: 'Espiritualidade',
  calendar: 'Calendário',
  history: 'Histórico',
  'direitos-deveres': 'Direitos e Deveres',
  content_view: 'Abertura de Conteúdo',
  other: 'Outro',
};

export function featureLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return FEATURE_LABELS[key] || key;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Há ${days}d`;
  const months = Math.floor(days / 30);
  return `Há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}
