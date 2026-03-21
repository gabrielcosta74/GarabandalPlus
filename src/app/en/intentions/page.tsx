import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Prayer Intentions',
  description: 'Send your intentions to Our Lady. Light a virtual candle and entrust your prayers to the Sanctuary of Garabandal.',
  alternates: {
    canonical: `${APP_URL}/en/intentions`,
  },
};

export { default } from '../../intencoes/page';
