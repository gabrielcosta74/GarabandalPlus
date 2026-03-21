import type { Metadata } from 'next';
import ClientLayout from '../../components/layouts/ClientLayout';

export const metadata: Metadata = {
  title: {
    template: '%s | Garabandal +',
    default: 'Garabandal +',
  },
  description: 'Virtual Sanctuary of the Garabandal Apostolate. Pilgrimages, donations and evangelisation mission focused on faith and the message of Our Lady.',
  keywords: [
    'Garabandal',
    'Garabandal Apostolate',
    'Catholic pilgrimage',
    'Catholic donations',
    'Message of Garabandal',
    'Virtual sanctuary',
    'Our Lady',
    'Evangelisation',
  ],
  openGraph: {
    locale: 'en_GB',
  },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientLayout locale="en">
      {children}
    </ClientLayout>
  );
}
