'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type HeroMemberActionProps = {
  locale: 'pt' | 'en';
  memberHref: string;
  becomeMemberHref: string;
};

export default function HeroMemberAction({
  locale,
  memberHref,
  becomeMemberHref,
}: HeroMemberActionProps) {
  const { isAuthenticated, isMember, loading } = useAuth();
  const hasMemberAccess = !loading && isAuthenticated && isMember;

  return (
    <Link
      href={hasMemberAccess ? memberHref : becomeMemberHref}
      className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-garabandal-gold px-8 py-4 text-center text-base font-bold tracking-tight text-garabandal-dark shadow-[0_10px_30px_-10px_rgba(212,175,55,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-400"
    >
      <span>
        {hasMemberAccess
          ? (locale === 'en' ? 'Member Area' : 'Área de Membro')
          : (locale === 'en' ? 'Become a Member' : 'Tornar-se Membro')}
      </span>
      <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}
