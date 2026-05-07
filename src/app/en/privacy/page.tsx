import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy of the Garabandal Apostolate platform — pilgrimages, donations, store and member area.',
  alternates: {
    canonical: `${APP_URL}/en/privacy`,
    languages: {
      en: `${APP_URL}/en/privacy`,
      'pt-BR': `${APP_URL}/privacidade`,
      'pt-PT': `${APP_URL}/privacidade`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/privacy`,
    title: 'Privacy Policy | Garabandal Apostolate',
    description: 'How we process personal data, data subject rights and security measures.',
  },
};

export { default } from '../../privacidade/page';
