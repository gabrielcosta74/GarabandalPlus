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

export type Tone = {
  /** Icon tile and pill background. */
  soft: string;
  /** Icon and pill text. */
  ink: string;
  /** Chart slice / bar. */
  chart: string;
};

/*
 * One material for every category: the icon carries the meaning, colour is
 * reserved for state (money in, needs attention). Keys kept so call sites and
 * the category map stay unchanged.
 */
const NEUTRAL: Tone = { soft: 'lg-icon', ink: 'text-zinc-700', chart: 'rgb(255 255 255 / 0.7)' };
const T = {
  rose: NEUTRAL, violet: NEUTRAL, sky: NEUTRAL, orange: NEUTRAL, emerald: NEUTRAL, indigo: NEUTRAL,
  teal: NEUTRAL, cyan: NEUTRAL, fuchsia: NEUTRAL, lime: NEUTRAL, slate: NEUTRAL, zinc: NEUTRAL,
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
  impostos: { icon: Landmark, tone: T.zinc, group: 'Impostos e Seg. Social' },
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
  complete: 'text-emerald-600',
  missing: 'bg-orange-500/[0.12] text-orange-600',
  confirm: 'bg-transparent !px-0 text-zinc-400',
  ignored: 'bg-zinc-900/[0.06] text-zinc-500',
};
