import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and Conditions for using the Garabandal Apostolate platform — pilgrimages, store, donations and membership.',
  alternates: {
    canonical: `${APP_URL}/en/terms`,
    languages: {
      en: `${APP_URL}/en/terms`,
      'pt-BR': `${APP_URL}/termos`,
      'pt-PT': `${APP_URL}/termos`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/terms`,
    title: 'Terms & Conditions | Garabandal Apostolate',
    description: 'Platform usage rules, payments, registrations and online store terms.',
  },
};

export { default } from '../../termos/page';
