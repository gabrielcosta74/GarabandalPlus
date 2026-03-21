import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Pilgrimages',
  description: 'Join our spiritual pilgrimages to Garabandal. Small groups, fully organised, with a rich spiritual programme.',
  alternates: {
    canonical: `${APP_URL}/en/pilgrimages`,
  },
};

export { default } from '../../peregrinacoes/page';
