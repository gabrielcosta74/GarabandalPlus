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
      className="btn-member group min-h-12 justify-center gap-3 rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-w-[14rem]"
    >
      <span>
        {hasMemberAccess
          ? (locale === 'en' ? 'Member Area' : 'Área de Membro')
          : (locale === 'en' ? 'Become a Member' : 'Ser Membro')}
      </span>
      <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
    </Link>
  );
}
