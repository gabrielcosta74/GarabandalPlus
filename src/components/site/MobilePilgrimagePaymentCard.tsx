'use client';

import Link from 'next/link';
import { ChevronRight, Ticket } from 'lucide-react';

type MobilePilgrimagePaymentCardProps = {
  href: string;
  isAuthenticated: boolean;
  isEnglish: boolean;
  isActive?: boolean;
  onClick: () => void;
};

export default function MobilePilgrimagePaymentCard({
  href,
  isAuthenticated,
  isEnglish,
  isActive = false,
  onClick,
}: MobilePilgrimagePaymentCardProps) {
  const title = isEnglish ? 'My Registrations' : 'Minhas Inscrições';
  const description = isAuthenticated
    ? (isEnglish ? 'View payments and pay your pilgrimage' : 'Ver pagamentos e pagar a peregrinação')
    : (isEnglish ? 'Sign in to view registrations and payments' : 'Entre para ver inscrições e pagamentos');

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`group mb-7 block rounded-2xl border p-4 shadow-md transition-all active:scale-[0.99] ${
        isActive
          ? 'border-garabandal-gold bg-garabandal-gold text-garabandal-dark'
          : 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 text-garabandal-dark hover:border-garabandal-gold hover:shadow-lg'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
          <Ticket className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{title}</span>
          <span className="mt-1 block text-xs font-semibold leading-snug text-slate-600">{description}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-amber-800 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
