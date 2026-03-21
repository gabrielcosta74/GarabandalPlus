import type { Metadata } from 'next';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'About the Apostolate',
  description: 'Learn about the history and mission of the Garabandal Apostolate. For over 16 years spreading the messages of Our Lady of Mount Carmel of Garabandal.',
  alternates: {
    canonical: `${APP_URL}/en/about`,
  },
};

export { default } from '../../sobre-nos/page';
