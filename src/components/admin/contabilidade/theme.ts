import {
  ArrowDownLeft,
  ArrowLeftRight,
  BadgeCheck,
  BedDouble,
  Calculator,
  CircleDashed,
  Cloud,
  CreditCard,
  Fuel,
  Globe,
  Heart,
  Landmark,
  Package,
  Percent,
  Phone,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  Stamp,
  Undo2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

/*
 * Visual language of the Contabilidade module (its own, not the rest of the
 * admin): each category has one icon and one hue. The hue appears as a soft
 * tile behind the icon, as the pill tint, and as the slice in the charts, so a
 * category is recognised by colour + icon everywhere on the page.
 */

export type Tone = {
  /** Icon tile and pill background. */
  soft: string;
  /** Icon and pill text. */
  ink: string;
  /** Chart slice / bar. */
  chart: string;
};

const T = {
  rose: { soft: 'bg-rose-50', ink: 'text-rose-600', chart: '#f43f5e' },
  violet: { soft: 'bg-violet-50', ink: 'text-violet-600', chart: '#8b5cf6' },
  sky: { soft: 'bg-sky-50', ink: 'text-sky-600', chart: '#0ea5e9' },
  orange: { soft: 'bg-orange-50', ink: 'text-orange-600', chart: '#f97316' },
  emerald: { soft: 'bg-emerald-50', ink: 'text-emerald-600', chart: '#10b981' },
  indigo: { soft: 'bg-indigo-50', ink: 'text-indigo-600', chart: '#6366f1' },
  teal: { soft: 'bg-teal-50', ink: 'text-teal-600', chart: '#14b8a6' },
  cyan: { soft: 'bg-cyan-50', ink: 'text-cyan-600', chart: '#06b6d4' },
  fuchsia: { soft: 'bg-fuchsia-50', ink: 'text-fuchsia-600', chart: '#d946ef' },
  lime: { soft: 'bg-lime-50', ink: 'text-lime-700', chart: '#84cc16' },
  slate: { soft: 'bg-slate-100', ink: 'text-slate-500', chart: '#94a3b8' },
  zinc: { soft: 'bg-zinc-100', ink: 'text-zinc-500', chart: '#a1a1aa' },
} satisfies Record<string, Tone>;

export type CategoryVisual = { icon: LucideIcon; tone: Tone; group: string };

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  doacao: { icon: Heart, tone: T.rose, group: 'Doações' },
  quota: { icon: BadgeCheck, tone: T.violet, group: 'Quotas' },
  peregrinacao: { icon: Plane, tone: T.sky, group: 'Peregrinações' },
  loja: { icon: ShoppingBag, tone: T.orange, group: 'Loja' },
  liquidacao_reduniq: { icon: Globe, tone: T.emerald, group: 'Pagamentos online' },
  liquidacao_stripe: { icon: CreditCard, tone: T.indigo, group: 'Pagamentos online' },
  fecho_tpa: { icon: Smartphone, tone: T.teal, group: 'MB Way / TPA' },
  outra_entrada: { icon: ArrowDownLeft, tone: T.slate, group: 'Outras entradas' },
  comissao_reduniq: { icon: Percent, tone: T.slate, group: 'Comissões e taxas' },
  comissao_bancaria: { icon: Landmark, tone: T.slate, group: 'Comissões e taxas' },
  imposto_selo: { icon: Stamp, tone: T.slate, group: 'Comissões e taxas' },
  software: { icon: Cloud, tone: T.indigo, group: 'Software e site' },
  comunicacoes: { icon: Phone, tone: T.cyan, group: 'Comunicações' },
  contabilidade: { icon: Calculator, tone: T.violet, group: 'Contabilidade' },
  viagem: { icon: Fuel, tone: T.sky, group: 'Viagens' },
  alojamento: { icon: BedDouble, tone: T.fuchsia, group: 'Alojamento e refeições' },
  remuneracao: { icon: UserRound, tone: T.emerald, group: 'Pessoas' },
  recibos_verdes: { icon: Receipt, tone: T.lime, group: 'Pessoas' },
  fornecedores: { icon: Package, tone: T.orange, group: 'Fornecedores' },
  devolucao: { icon: Undo2, tone: T.zinc, group: 'Outras' },
  outra_despesa: { icon: Receipt, tone: T.zinc, group: 'Outras despesas' },
  transferencia_interna: { icon: ArrowLeftRight, tone: T.zinc, group: 'Transferências internas' },
};

export const UNCATEGORISED: CategoryVisual = { icon: CircleDashed, tone: T.zinc, group: 'Por classificar' };

export function visualFor(code: string | null | undefined): CategoryVisual {
  return (code && CATEGORY_VISUALS[code]) || UNCATEGORISED;
}

/** Row status, as the admin reads it. */
export type RowState = 'complete' | 'missing' | 'confirm' | 'ignored';

export const STATE_PILL: Record<RowState, string> = {
  complete: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  missing: 'bg-orange-50 text-orange-700 ring-orange-600/10',
  confirm: 'bg-sky-50 text-sky-700 ring-sky-600/10',
  ignored: 'bg-zinc-100 text-zinc-500 ring-zinc-500/10',
};
