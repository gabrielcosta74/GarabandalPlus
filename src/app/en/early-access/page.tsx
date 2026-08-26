import type { Metadata } from 'next';
import EarlyAccessLanding from '../../../components/pilgrimage/EarlyAccessLanding';
import { getEarlyAccessCopy } from '../../../components/pilgrimage/early-access-copy';

const copy = getEarlyAccessCopy('en');

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: '/en/early-access',
    languages: {
      'pt-PT': '/acesso-antecipado',
      'pt-BR': '/acesso-antecipado',
      en: '/en/early-access',
    },
  },
};

export default function EarlyAccessPage() {
  return <EarlyAccessLanding locale="en" />;
}
