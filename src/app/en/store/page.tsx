import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Online Store',
  description: 'Find books, rosaries and devotional items from the Garabandal Apostolate.',
  alternates: {
    canonical: `${APP_URL}/en/store`,
  },
};

export { default } from '../../loja/page';
